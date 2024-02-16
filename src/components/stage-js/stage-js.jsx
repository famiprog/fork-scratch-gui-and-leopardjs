import bindAll from 'lodash.bindall';
import React from 'react';
import { injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import { Project } from 'sb-edit';
import { LoadingState } from '../../reducers/project-state';
import parserHtml from "prettier/parser-html";
import parserBabel from "prettier/parser-babel";

class StageJSComponent extends React.Component  {
    constructor(props) {
        super(props);
        bindAll(this, [
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
        // But there is a problem with this rplacement, because inside Leopard library there is a test 
        // for bitmap images like:
        // this.isBitmap = !this.url.match(/\.svg/);
        // this.resolution = this.isBitmap ? 2 : 1;
        // and the /\.svg/ regexp used above doesn't match a data url, only a normal URL for a svg image
        if (costume.ext == 'svg') {
            var regExpForResolution = new RegExp("(this\\.costumes = \\[.*?" + costumeUrl.replaceAll("/", "\\/") + ".*?\\];(?:this\\.costumes\\[\\d+\\]\.isBitmap=false;this\\.costumes[\\d+]\\.resolution=1;)*)", "s");
            indexJsContent = indexJsContent.replace(regExpForResolution, "$1this\.costumes[" + costumeIndex + "]\.isBitmap=false;this\.costumes[" + costumeIndex + "]\.resolution=1;")
        }
        
        return this.getModifiedContentForResource(indexJsContent, costume, costumeUrl, 'image', costume.ext == 'svg' ? 'svg+xml' : costume.ext);
    }
    
    getModifiedContentForSound(indexJsContent, sound, soundUrl) {
        return this.getModifiedContentForResource(indexJsContent, sound, soundUrl, "audio", sound.ext);
    }

    /** Replaces the actual URL with the corresponding data URL */
    getModifiedContentForResource(indexJsContent, resource, resourceUrl, dataType, ext) {
        var base64Data = this.arrayBufferToBase64(resource.asset);
        var dataUri = `data:${dataType}/${ext};base64,${base64Data}`;
        return indexJsContent.replace(resourceUrl, dataUri);
    }

    componentDidUpdate (prevProps) {
        if (this.props.projectChanged && !prevProps.projectChanged 
            || this.props.loadingState == LoadingState.SHOWING_WITHOUT_ID && prevProps.loadingState != LoadingState.SHOWING_WITHOUT_ID
            || this.props.loadingState == LoadingState.SHOWING_WITH_ID && prevProps.loadingState != LoadingState.SHOWING_WITH_ID) {
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

                var indexJsContent = "";
                var otherJsFiles = {};
                var htmlContent;
                console.log(files);
                for (var fileName in files) {
                    if (fileName === "index.js") {
                        indexJsContent = files[fileName];
                    } else if (fileName.endsWith(".js")) {
                        otherJsFiles[fileName] = files[fileName];
                    } else {
                        // There is only one html file: index.html
                        htmlContent = files[fileName];
                    }
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

                // We need to erase all the expors to avoid errors
                indexJsContent = indexJsContent.replaceAll("export default", "");

                // Replace the actual urls of sound and costumes with the corresponding data url
                for (const costume of project.stage.costumes) {
                    indexJsContent = this.getModifiedContentForCostume(
                                    indexJsContent, 
                                    costume, 
                                    "./Stage/costumes/" + costume.name + "." + costume.ext, 
                                    project.stage.costumes.indexOf(costume)
                                );
                }
            
                for (const sprite of project.sprites) {
                    for (const costume of sprite.costumes) {
                        indexJsContent = this.getModifiedContentForCostume(
                                            indexJsContent, 
                                            costume, 
                                            "./" + sprite.name + "/costumes/" + costume.name + "." + costume.ext, 
                                            sprite.costumes.indexOf(costume)
                                        );
                    }
                }

                for (const sound of project.stage.sounds) {
                    indexJsContent = this.getModifiedContentForSound(indexJsContent, sound, "./Stage/sounds/" + sound.name + "." + sound.ext);
                }

                for (const sprite of project.sprites) {
                    for (const sound of sprite.sounds) {
                        indexJsContent = this.getModifiedContentForSound(indexJsContent, sound, "./" + sprite.name + "/sounds/" + sound.name + "." + sound.ext);
                    }
                }

                // Insert the js code into html code
                htmlContent = htmlContent.replace('import project from "./index.js";', indexJsContent + "\n");
                console.log(htmlContent);
                this.setState({
                    // if the settingWasUpdated message is displayed, this will be the ID of its removal timer
                    htmlContent: htmlContent
                });
            });
        }
    }

    render () {
       return <iframe style={{width: "480px", height:"360px"}} src={"data:text/html;charset=utf-8," + encodeURIComponent(this.state.htmlContent)}></iframe> 
    }
}

const mapStateToProps = state => ({
    projectChanged: state.scratchGui.projectChanged,
    loadingState: state.scratchGui.projectState.loadingState,
    saveProjectSb3: state.scratchGui.vm.saveProjectSb3.bind(state.scratchGui.vm)
});

export default injectIntl(connect(
    mapStateToProps
)(StageJSComponent));