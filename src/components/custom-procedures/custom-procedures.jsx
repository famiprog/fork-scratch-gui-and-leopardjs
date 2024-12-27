import PropTypes from 'prop-types';
import React from 'react';
import Modal from '../../containers/modal.jsx';
import Box from '../box/box.jsx';
import {defineMessages, injectIntl, intlShape, FormattedMessage} from 'react-intl';

import booleanInputIcon from './icon--boolean-input.svg';
import textInputIcon from './icon--text-input.svg';
import labelIcon from './icon--label.svg';

import styles from './custom-procedures.css';
import ScratchBlocks from 'scratch-blocks';

const messages = defineMessages({
    myblockModalTitle: {
        defaultMessage: 'Make a Block',
        description: 'Title for the modal where you create a custom block.',
        id: 'gui.customProcedures.myblockModalTitle'
    },
    myblockModalTitleForJavascriptCall: {
        defaultMessage: 'Configure Inputs and Return Type',
        description: 'Title for the modal where you configure the function inputs and return type.',
        id: 'gui.customProcedures.myblockModalTitleForJavascriptCall'
    }
});


const CustomProcedures = (props) => {
    return (<Modal
        className={styles.modalContent}
        contentLabel={props.intl.formatMessage(props.isForJavascriptCall ? messages.myblockModalTitleForJavascriptCall : messages.myblockModalTitle)}
        onRequestClose={props.onCancel}
    >
        <Box className={styles.workspace} componentRef={props.componentRef} />
        <Box className={styles.body}>
            <div className={styles.optionsRow}>
                <div
                    className={styles.optionCard}
                    role="button"
                    tabIndex="0"
                    onClick={props.onAddTextNumber}
                >
                    <img className={styles.optionIcon} src={textInputIcon} />
                    <div className={styles.optionTitle}>
                        <FormattedMessage
                            defaultMessage="Add an input"
                            description="Label for button to add a number/text input"
                            id="gui.customProcedures.addAnInputNumberText"
                        />
                    </div>
                    <div className={styles.optionDescription}>
                        <FormattedMessage
                            defaultMessage="number or text"
                            description="Description of the number/text input type"
                            id="gui.customProcedures.numberTextType"
                        />
                    </div>
                </div>
                <div
                    className={styles.optionCard}
                    role="button"
                    tabIndex="0"
                    onClick={props.onAddBoolean}
                >
                    <img className={styles.optionIcon} src={booleanInputIcon} />
                    <div className={styles.optionTitle}>
                        <FormattedMessage
                            defaultMessage="Add an input"
                            description="Label for button to add a boolean input"
                            id="gui.customProcedures.addAnInputBoolean"
                        />
                    </div>
                    <div className={styles.optionDescription}>
                        <FormattedMessage
                            defaultMessage="boolean"
                            description="Description of the boolean input type"
                            id="gui.customProcedures.booleanType"
                        />
                    </div>
                </div>
                {!props.isForJavascriptCall && (
                    <div
                        className={styles.optionCard}
                        role="button"
                        tabIndex="0"
                        onClick={props.onAddLabel}
                    >
                        <img className={styles.optionIcon} src={labelIcon} />
                        <div className={styles.optionTitle}>
                            <FormattedMessage
                                defaultMessage="Add a label"
                                description="Label for button to add a label"
                                id="gui.customProcedures.addALabel"
                            />
                        </div>
                    </div>
                )}
            </div>
            {!props.isForJavascriptCall && (
                <div className={styles.checkboxRow}>
                    <label>
                        <input
                            checked={props.warp}
                            type="checkbox"
                            onChange={props.onToggleWarp}
                        />
                        <FormattedMessage
                            defaultMessage="Run without screen refresh"
                            description="Label for checkbox to run without screen refresh"
                            id="gui.customProcedures.runWithoutScreenRefresh"
                        />
                    </label>
                </div>
            )}
            {props.isForJavascriptCall && (
                // TODO DB maybe use another classname
                <div className={styles.checkboxRow}>
                        <label className={styles.returnLabel}>
                            {/* TODO DB change the id of the formatted message */}
                            <FormattedMessage
                                defaultMessage="Returns:"
                                description="Label for checkbox to run without screen refresh"
                                id="gui.customProcedures.return"
                            />
                        </label>
                        <label className={styles.radioInline}>
                            <input
                                type="radio"
                                name="return_type"
                                id="nothing"
                                value={ScratchBlocks.Procedures.RETURN_TYPE.NOTHING}
                                onChange={props.onReturnTypeChange}
                                checked={props.returnType == ScratchBlocks.Procedures.RETURN_TYPE.NOTHING}
                            />
                            {/* TODO DB: replace with formattedMessage */}
                            Nothing
                        </label>
                        <label className={styles.radioInline}>
                            <input
                                type="radio"
                                name="return_type"
                                id="text"
                                value={ScratchBlocks.Procedures.RETURN_TYPE.STRING}
                                onChange={props.onReturnTypeChange}
                                checked={props.returnType == ScratchBlocks.Procedures.RETURN_TYPE.STRING}
                            />
                            {/* TODO DB: replace with formattedMessage */}
                            Text
                        </label>
                        <label className={styles.radioInline}>
                            <input
                                type="radio"
                                name="return_type"
                                id="number"
                                value={ScratchBlocks.Procedures.RETURN_TYPE.NUMBER}
                                onChange={props.onReturnTypeChange}
                                checked={props.returnType == ScratchBlocks.Procedures.RETURN_TYPE.NUMBER}
                            />
                            {/* TODO DB: replace with formattedMessage */}
                            Number
                        </label>
                        <label className={styles.radioInline}>
                            <input
                                type="radio"
                                name="return_type"
                                id="boolean"
                                value={ScratchBlocks.Procedures.RETURN_TYPE.BOOLEAN}
                                onChange={props.onReturnTypeChange}
                                checked={props.returnType == ScratchBlocks.Procedures.RETURN_TYPE.BOOLEAN}
                            />
                            {/* TODO DB: replace with formattedMessage */}
                            Boolean
                        </label>
                </div>
            )}
            <Box className={styles.buttonRow}>
                <button
                    className={styles.cancelButton}
                    onClick={props.onCancel}
                >
                    <FormattedMessage
                        defaultMessage="Cancel"
                        description="Label for button to cancel custom procedure edits"
                        id="gui.customProcedures.cancel"
                    />
                </button>
                <button className={styles.okButton} onClick={props.onOk}>
                    <FormattedMessage
                        defaultMessage="OK"
                        description="Label for button to save new custom procedure"
                        id="gui.customProcedures.ok"
                    />
                </button>
            </Box>
        </Box>
    </Modal>)
};

CustomProcedures.propTypes = {
    componentRef: PropTypes.func.isRequired,
    intl: intlShape,
    onAddBoolean: PropTypes.func.isRequired,
    onAddLabel: PropTypes.func.isRequired,
    onAddTextNumber: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    onOk: PropTypes.func.isRequired,
    onToggleWarp: PropTypes.func.isRequired,
    warp: PropTypes.bool.isRequired,
    returnType: PropTypes.string.isRequired,
    onReturnTypeChange: PropTypes.func.isRequired,
    // TODO DB refactor: extract a common logic into a base class 
    isForJavascriptCall: PropTypes.bool.isRequired
};

export default injectIntl(CustomProcedures);
