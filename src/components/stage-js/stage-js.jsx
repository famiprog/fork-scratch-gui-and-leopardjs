import PropTypes from 'prop-types';
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
import { Console } from 'minilog';
import classNames from 'classnames';
import {STAGE_DISPLAY_SIZES} from '../../lib/layout-constants.js';
import { updateStageJsFilesVersion } from '../../reducers/stage-js-files-version.js';

const TRUSTED_ORIGINS_PATTERNS = [
    // In development, the address (of the webview of the vscode extension) looks like: 
    // http://12q9ut155tm2e1m5qvsri5pjgd6o913mctten638icadgb6o58bq.localhost:3000.
    // So it contains a dynamic generated part. That's why we need to use regexp
    /^http:\/\/\w+\.localhost:3000$/,
    /^vscode-webview:\/\//
    // Add more trusted origins for production 
];

class StageJSComponent extends React.Component {
    
    constructor (props) {
        super(props);
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
                case 'loadScratchFileResponse':
                    if (body.length != 0) {
                        // The loadProject() triggers PROJECT_CHANGED events (on every target, block, costume, sound, etc creation). 
                        // We want to avoid this
                        this.props.vm.off('PROJECT_CHANGED', this.projectChangedHandler);
                        
                        this.props.vm.loadProject(body).then(() => {
                            this.props.vm.on('PROJECT_CHANGED', this.projectChangedHandler);
                        }); 
                    } else {
                        // If the .sb3 file is empty on vscode, don't load nothing because there is already a default project that is loaded by the scratch app.
                        // Instead, signal vscode that there is a new scratch project (the default one) that can be saved.
                        window.parent.postMessage(
                            {type: 'scratchContentChanged'},
                            // TODO DB: Maybe we should specify a more specific targetOrigin
                            '*'
                        );
                    }
                    break;
                case 'getFileResponse':
                        // Redirect the file received from vscode to the service worker that initialy requested it
                        navigator.serviceWorker.ready.then(registration => {
                            registration.active.postMessage({ type: "getFileFromVSCodeResponse", fileContent: event.data.fileContent, requestUId: event.data.requestUId });
                        });
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
                case 'saveLeopardFilesResponse':
                    props.onReloadJsProject();
                    break;
            }
        });
    }

    componentDidMount() {
        this.props.vm.on('PROJECT_CHANGED', this.projectChangedHandler);
        setTimeout(() => this.loadScratchFileFromVscode(), 3000);
        
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', event => {
                switch(event.data.type) {
                    case "getClientIdResponse":
                        this.setState({
                            clientId: event.data.clientId
                        });
                      break;
                    case "getFileFromVSCode":
                      window.parent.postMessage(
                            {type: 'getFile', body: event.data.path, requestUId: event.data.requestUId},
                            // TODO DB: Maybe we should specify a more specific targetOrigin
                            '*'
                        );
                      break;
                  }
            });

            // When the iframe requests a file from the service worker, the service worker needs to request that file from the vscode app. 
            // But because it can not do this directly, it should message first the scratch app (via stage-js component), that forwards the message to the vscode app
            // For this, the scratch app needs to initiate the communication with the service worker in order to store its clientId. 
            // This client id is later forwarded back to the service worker when the iframe requests(fetches) some file from the service worker
            navigator.serviceWorker.ready.then(registration => {
                registration.active.postMessage({type: "getClientId"});
            });
        } else {
            console.log('Service worker absent');
        }
    }

    projectChangedHandler() {
        // Post the message to vscode to see the ".sb3" as modified
        window.parent.postMessage(
            {type: 'scratchContentChanged'},
            // TODO DB: Maybe we should specify a more specific targetOrigin
            '*'
        );
        // For the response handler: @see constructor()
    }

    loadScratchFileFromVscode() {
        window.parent.postMessage(
            {type: 'loadScratchFile'},
            // TODO DB: Maybe we should specify a more specific targetOrigin
            '*'
        );
    }

    render () {
        const {
            isFullScreen,
            stageSize,
            jsFilesVersions
        } = this.props;

        const stageDimensions = getStageDimensions(stageSize, isFullScreen);
        return (
            <Box className={styles.stageWrapper}>
                <Box
                    className={classNames(styles.stage, {
                        [styles.fullScreen]: isFullScreen,
                    })}
                >
                    <iframe
                        style={{
                            height: stageDimensions.height,
                            width: stageDimensions.width,
                            border: 0
                        }}
                        key={jsFilesVersions}
                        src={`http://localhost:8601/leopard/index.html?parentAppClientId=${this.state.clientId}`}
                    />
                </Box>
            </Box>
        );
    }
}

StageJSComponent.propTypes = {
    isFullScreen: PropTypes.bool.isRequired,
    stageSize: PropTypes.oneOf(Object.keys(STAGE_DISPLAY_SIZES)).isRequired
};

const mapStateToProps = state => ({
    projectChanged: state.scratchGui.projectChanged,
    loadingState: state.scratchGui.projectState.loadingState,
    saveProjectSb3: state.scratchGui.vm.saveProjectSb3.bind(state.scratchGui.vm),
    vm: state.scratchGui.vm,
    isFullScreen: state.scratchGui.mode.isFullScreen,
    jsFilesVersions: state.scratchGui.stageJsFilesVersion
});

const mapDispatchToProps = (dispatch) => ({
    onReloadJsProject: () => dispatch(updateStageJsFilesVersion())
});

export default injectIntl(connect(
    mapStateToProps, mapDispatchToProps
)(StageJSComponent));

