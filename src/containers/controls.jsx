import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import VM from 'scratch-vm';
import {connect} from 'react-redux';

import ControlsComponent from '../components/controls/controls.jsx';
import { updateStageJsFilesVersion } from '../reducers/stage-js-files-version.js';
import { Project } from 'sb-edit';
import parserBabel from 'prettier/parser-babel.js';
import parserHtml from 'prettier/parser-html.js';
import { STAGE_DISPLAY_SIZES } from '../lib/layout-constants.js';

class Controls extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleGreenFlagClick',
            'handleStopAllClick',
            'handleGenerateJSProject',
            'handleReloadJSProject'
        ]);
    }
    handleGreenFlagClick (e) {
        e.preventDefault();
        if (e.shiftKey) {
            this.props.vm.setTurboMode(!this.props.turbo);
        } else {
            if (!this.props.isStarted) {
                this.props.vm.start();
            }
            this.props.vm.greenFlag();
        }
    }
    handleStopAllClick (e) {
        e.preventDefault();
        this.props.vm.stopAll();
    }

    handleGenerateJSProject() {
        this.props.saveProjectSb3().then(async content => {
            const project = await Project.fromSb3(content);
            const files = project.toLeopard(
                {
                    includeGreenFlag: false,
                },
                {
                    printWidth: 100,
                    tabWidth: 2,
                    htmlWhitespaceSensitivity: 'strict',
                    plugins: [parserBabel, parserHtml],
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

            this.saveLeopardFilesToVscode(files);
        });
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

    handleReloadJSProject() {
        this.props.onReloadJSProject();
    }

    render () {
        const {
            vm, // eslint-disable-line no-unused-vars
            isStarted, // eslint-disable-line no-unused-vars
            projectRunning,
            turbo,
            saveProjectSb3,
            ...props
        } = this.props;
        return (
            <ControlsComponent
                {...props}
                active={projectRunning}
                turbo={turbo}
                onGreenFlagClick={this.handleGreenFlagClick}
                onStopAllClick={this.handleStopAllClick}
                onGenerateJSProject={this.handleGenerateJSProject}
                onReloadJSProject={this.handleReloadJSProject}
            />
        );
    }
}

Controls.propTypes = {
    isStarted: PropTypes.bool.isRequired,
    projectRunning: PropTypes.bool.isRequired,
    turbo: PropTypes.bool.isRequired,
    vm: PropTypes.instanceOf(VM),
    isFullScreen: PropTypes.bool.isRequired,
    stageSize: PropTypes.oneOf(Object.keys(STAGE_DISPLAY_SIZES)).isRequired,
    saveProjectSb3: PropTypes.func
};

const mapStateToProps = state => ({
    isStarted: state.scratchGui.vmStatus.running,
    projectRunning: state.scratchGui.vmStatus.running,
    turbo: state.scratchGui.vmStatus.turbo,
    saveProjectSb3: state.scratchGui.vm.saveProjectSb3.bind(state.scratchGui.vm),
    isFullScreen: state.scratchGui.mode.isFullScreen,
    stageSize: state.scratchGui.stageSize.stageSize,
});

const mapDispatchToProps = (dispatch) => ({
    onReloadJSProject: () => dispatch(updateStageJsFilesVersion())
});

export default connect(mapStateToProps, mapDispatchToProps)(Controls);
