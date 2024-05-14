import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, injectIntl, intlShape} from 'react-intl';

import GreenFlag from '../green-flag/green-flag.jsx';
import StopAll from '../stop-all/stop-all.jsx';
import TurboMode from '../turbo-mode/turbo-mode.jsx';

import styles from './controls.css';
import Box from '../box/box.jsx';
import Button from '../button/button.jsx';
import fileUpload from './file-upload.svg';
import fileDownload from './file-download.svg';
import { STAGE_DISPLAY_SIZES } from '../../lib/layout-constants.js';

const messages = defineMessages({
    goTitle: {
        id: 'gui.controls.go',
        defaultMessage: 'Go',
        description: 'Green flag button title'
    },
    stopTitle: {
        id: 'gui.controls.stop',
        defaultMessage: 'Stop',
        description: 'Stop button title'
    },
    generateJs: {
        id: 'gui.controls.generateJs',
        defaultMessage: 'Generate JS',
        description: 'Generate JS and save to VSCode'
    },
    loadJs: {
        id: 'gui.controls.loadJs',
        defaultMessage: 'Load JS',
        description: 'Load JS from VSCode'
    },
});

const Controls = function (props) {
    const {
        active,
        className,
        intl,
        onGreenFlagClick,
        onStopAllClick,
        onGenerateJSProject,
    onReloadJSProject,
        turbo,
        isFullScreen, 
        stageSize,
        ...componentProps
    } = props;

    let generateAndLoadJsButtons; 
    if (isFullScreen || stageSize != STAGE_DISPLAY_SIZES[STAGE_DISPLAY_SIZES.small]) {
        generateAndLoadJsButtons = (
            <>
                <Button className={styles.button} onClick={onGenerateJSProject}>
                    {props.intl.formatMessage(messages.generateJs)}
                </Button>
                <Button className={styles.button} onClick={onReloadJSProject}>
                    {props.intl.formatMessage(messages.loadJs)}
                </Button>
            </>
        );
    } else {
        generateAndLoadJsButtons = (<><img
            className={styles.icon}
            draggable={false}
            src={fileDownload}
            title={props.intl.formatMessage(messages.generateJs)}
            onClick={onGenerateJSProject}
        />
        <img
            className={styles.icon}
            draggable={false}
            src={fileUpload}
            title={props.intl.formatMessage(messages.loadJs)}
            onClick={onReloadJSProject}
        /></>);
    }

    return (
        <div
            className={classNames(styles.controlsContainer, className)}
            {...componentProps}
        >
            <GreenFlag
                active={active}
                title={intl.formatMessage(messages.goTitle)}
                onClick={onGreenFlagClick}
            />
            <StopAll
                active={active}
                title={intl.formatMessage(messages.stopTitle)}
                onClick={onStopAllClick}
            />
            {turbo ? (
                <TurboMode />
            ) : null}
                {generateAndLoadJsButtons}
        </div>
    );
};

Controls.propTypes = {
    active: PropTypes.bool,
    className: PropTypes.string,
    intl: intlShape.isRequired,
    onGreenFlagClick: PropTypes.func.isRequired,
    onStopAllClick: PropTypes.func.isRequired,
    onGenerateJSProject: PropTypes.func.isRequired,
    onReloadJSProject: PropTypes.func.isRequired,
    turbo: PropTypes.bool,
    isFullScreen: PropTypes.bool.isRequired,
    stageSize: PropTypes.oneOf(Object.keys(STAGE_DISPLAY_SIZES)).isRequired
};

Controls.defaultProps = {
    active: false,
    turbo: false
};

export default injectIntl(Controls);
