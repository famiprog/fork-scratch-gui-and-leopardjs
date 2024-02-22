import bindAll from 'lodash.bindall';
import React from 'react';
import { injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import { Project } from 'sb-edit';
import { LoadingState } from '../../reducers/project-state';
import parserHtml from "prettier/parser-html";
import parserBabel from "prettier/parser-babel";
import Button from '../button/button.jsx';
import styles from './stage-js.css';
import { getStageDimensions } from '../../lib/screen-utils';
import Box from '../box/box.jsx';

class StageJSComponent extends React.Component {
    constructor(props) {
        super(props);
        bindAll(this, [
            'generateJsProject',
            'loadFromServer',
            'saveToServer'
        ]);
        this.state = {
        }
    }

    arrayBufferToBase64(buffer) {
        var binary = "";
        var bytes = new Uint8Array(buffer);
        var len = bytes.byteLength;

        for (var i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }

        return btoa(binary);
    }

    getModifiedContentForCostume(indexJsContent, costume, costumeUrl, costumeIndex) {
        // We are replacing the actual url with a data url
        // But there is a problem with this replacement, because inside Leopard library there is a test 
        // for bitmap images like:
        // this.isBitmap = !this.url.match(/\.svg/);
        // this.resolution = this.isBitmap ? 2 : 1;
        // and the /\.svg/ regexp used above doesn't match a data url, only a normal URL for a svg image
        if (costume.ext == 'svg') {
            var regExpForResolution = new RegExp("(this\\.costumes = \\[.*?" + costumeUrl.replaceAll("/", "\\/") + ".*?\\];(?:this\\.costumes\\[\\d+\\]\.isBitmap=false;this\\.costumes[\\d+]\\.resolution=1;)*)", "s");
            indexJsContent = indexJsContent.replace(regExpForResolution, "$1this\.costumes[" + costumeIndex + "]\.isBitmap=false;this\.costumes[" + costumeIndex + "]\.resolution=1;")
        }

        return this.getModifiedContentForResource(indexJsContent, costume.asset, costumeUrl, 'image', costume.ext == 'svg' ? 'svg+xml' : costume.ext);
    }

    getModifiedContentForSound(indexJsContent, sound, soundUrl) {
        return this.getModifiedContentForResource(indexJsContent, sound.asset, soundUrl, "audio", sound.ext);
    }

    /** Replaces the actual URL with the corresponding data URL */
    getModifiedContentForResource(indexJsContent, resourceContent, resourceUrl, dataType, ext) {
        var base64Data = this.arrayBufferToBase64(resourceContent);
        var dataUri = `data:${dataType}/${ext};base64,${base64Data}`;
        return indexJsContent.replace(resourceUrl, dataUri);
    }

    generateJsProject() {
        this.props.saveProjectSb3().then(async content => {
            const project = await Project.fromSb3(content);
            const files = project.toLeopard(
                {
                    printWidth: 100,
                    tabWidth: 2, // Set the tab width for both HTML and JavaScript
                    htmlWhitespaceSensitivity: "strict"
                },
                {
                    plugins: [parserBabel, parserHtml],
                    tabWidth: 2,
                },
            );

            var filesMap = {};

            var indexJsContent = "";
            var otherJsFiles = {};
            var htmlContent;

            for (var fileName in files) {
                if (fileName === "index.js") {
                    indexJsContent = files[fileName];
                } else if (fileName.endsWith(".js")) {
                    otherJsFiles[fileName] = files[fileName];
                } else {
                    // There is only one html file: index.html
                    htmlContent = files[fileName];
                }
                filesMap[fileName] = files[fileName];
            }

            // Replace each import of a js file with the actual content of that file
            for (var fileName in otherJsFiles) {
                var componentName = fileName.substring(fileName.lastIndexOf("/") + 1, fileName.lastIndexOf(".js"));
                var content = otherJsFiles[fileName];
                if (content.indexOf("extends Sprite") >= 0) {
                    // The `Sprite` is already imported in the main index.js file. 
                    // So we need to avoid importing it again (else an error is thrown).
                    content = content.replace(/import {\s*Sprite(?:.|\s)+?;/, '');
                }
                indexJsContent = indexJsContent.replace('import ' + componentName + ' from "./' + fileName + '";', "\n" + content + "\n");
            }

            // We need to erase all the exports to avoid errors
            indexJsContent = indexJsContent.replaceAll("export default", "");

            // Replace the actual urls of sound and costumes with the corresponding data url
            for (const costume of project.stage.costumes) {
                const fileUrl = "./Stage/costumes/" + costume.name + "." + costume.ext;
                indexJsContent = this.getModifiedContentForCostume(
                    indexJsContent,
                    costume,
                    fileUrl,
                    project.stage.costumes.indexOf(costume)
                );
                filesMap[fileUrl] = costume.asset;
            }

            for (const sprite of project.sprites) {
                for (const costume of sprite.costumes) {
                    const fileUrl = "./" + sprite.name + "/costumes/" + costume.name + "." + costume.ext;
                    indexJsContent = this.getModifiedContentForCostume(
                        indexJsContent,
                        costume,
                        fileUrl,
                        sprite.costumes.indexOf(costume)
                    );
                    filesMap[fileUrl] = costume.asset;
                }
            }

            for (const sound of project.stage.sounds) {
                const fileUrl = "./Stage/sounds/" + sound.name + "." + sound.ext;
                indexJsContent = this.getModifiedContentForSound(indexJsContent, sound, fileUrl);
                filesMap[fileUrl] = sound.asset;
            }

            for (const sprite of project.sprites) {
                for (const sound of sprite.sounds) {
                    const fileUrl = "./" + sprite.name + "/sounds/" + sound.name + "." + sound.ext;
                    indexJsContent = this.getModifiedContentForSound(indexJsContent, sound, fileUrl);
                    filesMap[fileUrl] = sound.asset;
                }
            }

            // Insert the js code into html code
            htmlContent = htmlContent.replace('import project from "./index.js";', indexJsContent + "\n");
            this.setState({
                // if the settingWasUpdated message is displayed, this will be the ID of its removal timer
                htmlContent: htmlContent,
                leopardFilesMap: filesMap
            });
        });
    }

    loadFromServer() {
        fetch("http://localhost:3000/api/load")
            .then(response => response.json())
            .then((response) => {
                for (const [fileName, fileInfo] of Object.entries(response.filesMap)) {
                    if (fileName.includes("project.sb3")) {
                        const content = atob(fileInfo.content);
                        const byteArray = new Uint8Array(content.length);
                        for (let i = 0; i < content.length; i++) {
                            byteArray[i] = content.charCodeAt(i);
                        }
                        return this.props.vm.loadProject(byteArray);
                    } else if (fileName.includes("iframe.html")) {
                        this.setState({
                            htmlContent: atob(fileInfo.content)
                        });
                    }
                }
            });
    }

    saveToServer() {
        this.props.saveProjectSb3().then(async content => {
            const formData = new FormData();
            formData.append("scratch", content, "project.sb3");
            formData.append("iframe", new Blob([this.state.htmlContent], { type: 'text/html' }), "iframe.html");

            let i = 0;
            for (const [url, content] of Object.entries(this.state.leopardFilesMap)) {
                const lastSlashIndex = url.lastIndexOf('/');
                const path = url.substring(0, lastSlashIndex); // "folder1/folder2"
                const fileName = url.substring(lastSlashIndex + 1);

                formData.append("leopard", new Blob([content], { type: 'text/plain' }), fileName);
                formData.append("leopard[" + i + "]", path);
                i++;
            }

            fetch("http://localhost:3000/api/save",
                {
                    method: "POST",
                    body: formData
                }
            );
        });
    }

    componentDidUpdate(prevProps) {
        if (this.props.projectChanged && !prevProps.projectChanged
            || this.props.loadingState == LoadingState.SHOWING_WITHOUT_ID && prevProps.loadingState != LoadingState.SHOWING_WITHOUT_ID
            || this.props.loadingState == LoadingState.SHOWING_WITH_ID && prevProps.loadingState != LoadingState.SHOWING_WITH_ID) {
            this.generateJsProject();
        }
    }

    render() {
        const stageDimensions = getStageDimensions(this.props.stageSize, this.props.isFullScreen);
        return <Box className={styles.stageWrapper}
            style={{
                height: stageDimensions.height,
                width: stageDimensions.width,
            }}>
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

            <iframe className={styles.iframe} src={"data:text/html;charset=utf-8," + encodeURIComponent(this.state.htmlContent)}></iframe>
        </Box>;
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