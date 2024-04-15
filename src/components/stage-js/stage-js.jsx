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
            'loadLeopardFilesFromVscode',
            'loadScratchFileFromVscode',
            'saveLeopardFilesToVscode'
        ]);
        this.state = {};

        if (window.parent == window) {
            throw new Error("This app should be embeded inside a vscode editor");
        }
        
        //TODO DB: add an "update" event listener when the file is modified from another editor
        window.addEventListener('message', event => {
            var isTrusted = TRUSTED_ORIGINS_PATTERNS.some(function(origin) {
                return origin.test(event.origin);
            });
            if (!isTrusted) {
                return;
            }
            const { type, body, requestId } = event.data;
            switch (type) {
                case 'loadScratchFileResponce':
                    // The loadProject() triggers PROJECT_CHANGED events (on every target, block, costume, sound, etc creation). 
                    // We want to avoid this
                    this.props.vm.off('PROJECT_CHANGED', this.projectChangedHandler);
                    if (body.length != 0) {
                        this.props.vm.loadProject(body).then(() => {
                            this.props.vm.on('PROJECT_CHANGED', this.projectChangedHandler);
                        }); 
                    } else {
                        // If the .sb3 file is empty on vscode, don't load nothing because there is already a default project that is loaded by the scratch app.
                        // Instead, signal vscode that there is a new scratch project (the default one) that can be saved.
                        window.parent.postMessage(
                            {type: 'scratch content changed'},
                            // TODO DB: Maybe we should specify a more specific targetOrigin
                            '*'
                        );
                    }
                    break;
                case 'loadLeopardFilesResponce':
                    const filesForIFrame = {};
                    for (const [fileName, fileInfo] of Object.entries(body)) {
                        let content = fileInfo;
                        if (fileName.endsWith('.html') || fileName.includes('.js') || fileName.includes('.svg')) {
                            content = new TextDecoder('utf-8').decode(content);
                        }
                        filesForIFrame[fileName] = content;
                    }
                    // Load the Leopard js project
                    this.loadFilesIntoIFrame(filesForIFrame);
                    break;
                case 'getScratchFile':
                    this.props.saveProjectSb3().then(async content => {
                        // The content is a BLOB and we need to convert it to Uint8Array.
                        // This is because the message is redirected by the webview to the vscode extension using `vscode.postMessage`(@ see extension.ts#_getHtmlForWebview)
                        // But `vscode.postMessage` doesn't accept sending BLOBs (see https://code.visualstudio.com/api/references/vscode-api#Webview)
                        const scratchContent = new Uint8Array(await new Response(content).arrayBuffer());
                        
                        window.parent.postMessage(
                            {
                                type: 'response', 
                                requestId,
                                body: scratchContent
                            },
                            // TODO DB: Maybe we should specify a more specific targetOrigin
                            '*' 
                        );
                    });
                    break;
            }
        });
    }

    componentDidMount() {
        this.props.vm.on('PROJECT_CHANGED', this.projectChangedHandler);
        this.loadScratchFileFromVscode();
        this.loadLeopardFilesFromVscode();
    }

    projectChangedHandler() {
        // Post the message to vscode to see the ".sb3" as modified
        window.parent.postMessage(
            {type: 'scratch content changed'},
            // TODO DB: Maybe we should specify a more specific targetOrigin
            '*'
        );
        // For the response handler: @see constructor()
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
            this.saveLeopardFilesToVscode(files);
        });
    }

    loadScratchFileFromVscode() {
        window.parent.postMessage(
            {type: 'loadScratchFile'},
            // TODO DB: Maybe we should specify a more specific targetOrigin
            '*'
        );
    }

    loadLeopardFilesFromVscode() {
        window.parent.postMessage(
            {type: 'loadLeopardFiles'},
            // TODO DB: Maybe we should specify a more specific targetOrigin
            '*'
        );
    }

    saveLeopardFilesToVscode (files) {
        window.parent.postMessage(
            {
                type: 'saveLeopardFiles', 
                body: files
            },
            // TODO DB: Maybe we should specify a more specific targetOrigin
            '*' 
        );
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
                            No leopard files generated/found besides the '.sb3' file. </br> Try to press the <b>"Generate JS"</b>. </br>
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
                    onClick={this.loadLeopardFilesFromVscode}
                >
                    Load JS
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

