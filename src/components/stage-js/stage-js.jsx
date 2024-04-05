import bindAll from 'lodash.bindall';
import React from 'react';
import {injectIntl} from 'react-intl';
import {connect} from 'react-redux';
import {Project} from 'sb-edit';
import {LoadingState} from '../../reducers/project-state';
import parserHtml from 'prettier/parser-html';
import parserBabel from 'prettier/parser-babel';
import Button from '../button/button.jsx';
import styles from './stage-js.css';
import {getStageDimensions} from '../../lib/screen-utils';
import Box from '../box/box.jsx';

const TRUSTED_ORIGINS_PATTERNS = [
    // In development, the address (of the webview of the vscode extension) looks like: 
    // http://12q9ut155tm2e1m5qvsri5pjgd6o913mctten638icadgb6o58bq.localhost:3000.
    // So it contains a dynamic generated part. That's why we need to use regexp
    /^http:\/\/\w+\.localhost:3000$/
    // Add more trusted origins for production 
];

class StageJSComponent extends React.Component {
    
    constructor (props) {
        super(props);
        bindAll(this, [
            'generateJsProject',
            'loadFromServer',
            'saveToServer'
        ]);
        this.state = {};
        
        // TODO DB If we will always use the application only as an extension inside VS code, 
        // window.parent != window will always be true so this check should be remove
        if (window.parent != window) {
            window.addEventListener('message', event => {
                var isTrusted = TRUSTED_ORIGINS_PATTERNS.some(function(origin) {
                    return origin.test(event.origin);
                });
                if (!isTrusted) {
                    return;
                }
                switch (event.data.command) {
                    case 'load files response':
                        const filesForIFrame = {};
                        for (const [fileName, fileInfo] of Object.entries(event.data.files)) {
                            let content = fileInfo;
                            if (fileName.endsWith('.html') || fileName.includes('.js') || fileName.includes('.svg')) {
                                content = new TextDecoder('utf-8').decode(content);
                            }

                            if (fileName.includes('project.sb3')) {
                                // Load the Scratch project
                                this.props.vm.loadProject(content);
                            } else {
                                filesForIFrame[fileName] = content;
                            }
                        }
                        // Load the Leopard js project
                        this.loadFilesIntoIFrame(filesForIFrame);
                        break;
                }
            });
        }
    }

    componentDidMount() {
        this.loadFromServer();
    }

    componentWillReceiveProps (prevProps) {
        if (this.props.projectChanged && !prevProps.projectChanged ||
            this.props.loadingState == LoadingState.SHOWING_WITHOUT_ID && prevProps.loadingState != LoadingState.SHOWING_WITHOUT_ID ||
            this.props.loadingState == LoadingState.SHOWING_WITH_ID && prevProps.loadingState != LoadingState.SHOWING_WITH_ID) {
            this.generateJsProject();
        }
    }
    generateJsProject () {
        this.props.saveProjectSb3().then(async content => {
            const project = await Project.fromSb3(content);
            const files = project.toLeopard(
                {
                    printWidth: 100,
                    tabWidth: 2,
                    htmlWhitespaceSensitivity: 'strict'
                },
                {
                    plugins: [parserBabel, parserHtml],
                    tabWidth: 2
                }
            );

            // The files contains only the js files. Add also the assets files
            for (const costume of project.stage.costumes) {
                files[`./Stage/costumes/${costume.name}.${costume.ext}`] = costume.asset;
            }

            for (const sprite of project.sprites) {
                for (const costume of sprite.costumes) {
                    files[`./${sprite.name}/costumes/${costume.name}.${costume.ext}`] = costume.asset;
                }
            }

            for (const sound of project.stage.sounds) {
                files[`./Stage/sounds/${sound.name}.${sound.ext}`] = sound.asset;
            }

            for (const sprite of project.sprites) {
                for (const sound of sprite.sounds) {
                    files[`./${sprite.name}/sounds/${sound.name}.${sound.ext}`] = sound.asset;
                }
            }

            this.loadFilesIntoIFrame(files);
        });
    }
    
    /**
     * Helper function
     */
    toByteArray (string) {
        const byteArray = new Uint8Array(string.length);
        for (let i = 0; i < string.length; i++) {
            byteArray[i] = string.charCodeAt(i);
        }
        return byteArray;
    }

    loadFromServer () {
        // TODO DB If we will always use the application only as an extension inside VS code, 
        // window.parent != window will always be true so this check should be remove so also the else branch
        if (window.parent != window) {
            window.parent.postMessage(
                {command: 'load files'},
                // TODO DB: Maybe we should specify a more specific targetOrigin
                '*'
            );
            // For the response handler: @see constructor()
        } else {
            fetch('http://localhost:3001/api/load')
                .then(response => response.json())
                .then(response => {
                    const filesForIFrame = {};
                    for (const [fileName, fileInfo] of Object.entries(response.filesMap)) {
                        let content = atob(fileInfo.content);
                        if (fileName.includes('costumes') || fileName.includes('sounds') || fileName.includes('project.sb3')) {
                            content = this.toByteArray(content);
                        }

                        if (fileName.includes('project.sb3')) {
                            this.props.vm.loadProject(content);
                        } else {
                            filesForIFrame[fileName.replace('storage-server/data/leopard', '.')] = content;
                        }
                    }

                    this.loadFilesIntoIFrame(filesForIFrame);
                });
        }
    }

    saveToServer () {
        this.props.saveProjectSb3().then(async content => {
            // TODO DB If we will always use the application only as an extension inside VS code, 
            // window.parent != window will always be true so this check should be remove so also the else branch
            if (window.parent != window) {
                // The content is a BLOB and we need to convert it to Uint8Array.
                // This is because the message is redirected by the webview to the vscode extension using `vscode.postMessage`(@ see extension.ts#_getHtmlForWebview)
                // But `vscode.postMessage` doesn't accept sending BLOBs (see https://code.visualstudio.com/api/references/vscode-api#Webview)
                const scratchContent = new Uint8Array(await new Response(content).arrayBuffer());
                
                window.parent.postMessage(
                    {
                        command: 'save files', 
                        files:{
                            "scratch": scratchContent,
                            "leopard": this.state.leopardFiles
                        }
                    },
                    // TODO DB: Maybe we should specify a more specific targetOrigin
                    '*' 
                );
            } else {
                const formData = new FormData();
                formData.append('scratch', content, 'project.sb3');

                let i = 0;
                for (const [url, content] of Object.entries(this.state.leopardFiles)) {
                    const lastSlashIndex = url.lastIndexOf('/');
                    const path = url.substring(0, lastSlashIndex);
                    const fileName = url.substring(lastSlashIndex + 1);

                    formData.append('leopard', new Blob([content], {type: 'text/plain'}), fileName);
                    formData.append(`leopard[${i}]`, path);
                    i++;
                }

                fetch('http://localhost:3001/api/save',
                    {
                        method: 'POST',
                        body: formData
                    }
                );
            }
        });
    }

    loadFilesIntoIFrame (files) {
        this.setState({
            leopardFiles: files
        });

        if (!files || Object.keys(files).length === 0) {
            return;
        }

        // Send the generated content to the service worker that will serve those files to the iframe
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.active.postMessage(files);
            });

            navigator.serviceWorker.addEventListener('message', event => {
                this.setState({
                    clientId: event.data,
                    // This is needed to force the iframe to reload the content
                    // Because at a regeneration, the URL remains the same
                    // but the files served by the service worker changed
                    iframeKey: (this.state.iframeKey === undefined) ? 0 : this.state.iframeKey + 1
                });
            });
        } else {
            console.log('Service worker absent');
        }
    }

    getIFrameSrc (files, clientId) {
        // Display an error message in case the files could not be loaded
        if (!files || Object.keys(files).length == 0) {
            return `data:text/html;charset=utf-8,${encodeURIComponent(`
                <html>
                    <body>
                       <p> 
                            No leopard files generated/found on server. </br> Try to press the <b>"Generate JS"</b> followed by <b>"Save to server"</b> button. </br>
                            If this doesn't work, an error occured. Look in the console for any error messages.
                        </p>
                    </body>
                </html>
            `)}`;
        }

        return `http://localhost:8601/leopard.html?parentAppClientId=${clientId}`;
    }

    render () {
        const stageDimensions = getStageDimensions(this.props.stageSize, this.props.isFullScreen);
        return (<Box
            className={styles.stageWrapper}
            style={{
                height: stageDimensions.height,
                width: stageDimensions.width
            }}
        >
            <Box className={styles.buttonsWrapper}>
                <Button
                    className={styles.button}
                    onClick={this.generateJsProject}
                >
                    Generate JS
                </Button>
                <Button
                    className={styles.button}
                    onClick={this.loadFromServer}
                >
                    Load (scratch + js)
                </Button>
                <Button
                    className={styles.button}
                    onClick={this.saveToServer}
                >
                    Save to server
                </Button>
            </Box>

            <iframe
                key={this.state.iframeKey}
                className={styles.iframe}
                src={this.getIFrameSrc(this.state.leopardFiles, this.state.clientId)}
            />
        </Box>);
    }
}

const mapStateToProps = state => ({
    projectChanged: state.scratchGui.projectChanged,
    loadingState: state.scratchGui.projectState.loadingState,
    saveProjectSb3: state.scratchGui.vm.saveProjectSb3.bind(state.scratchGui.vm),
    vm: state.scratchGui.vm
});

export default injectIntl(connect(
    mapStateToProps
)(StageJSComponent));
