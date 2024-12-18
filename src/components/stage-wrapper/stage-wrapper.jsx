import PropTypes from 'prop-types';
import React, { useState } from 'react';
import classNames from 'classnames';
import VM from 'scratch-vm';

import Box from '../box/box.jsx';
import {STAGE_DISPLAY_SIZES} from '../../lib/layout-constants.js';
import StageHeader from '../../containers/stage-header.jsx';
import Stage from '../../containers/stage.jsx';
import Loader from '../loader/loader.jsx';

import styles from './stage-wrapper.css';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import tabStyles from 'react-tabs/style/react-tabs.css';
import guiStyles from '../gui/gui.css';
import { FormattedMessage, injectIntl } from 'react-intl';
import { activateStageTab } from '../../reducers/stage-wrapper-tab.js';
import { connect } from 'react-redux';
import scratchCatIcon from './icon--scratch-cat.svg';
import javascriptIcon from './icon--javascript.svg';
import StageJSComponent from '../stage-js/stage-js.jsx'
import { style } from 'scratch-storage';

const StageWrapperComponent = function (props) {
    const {
        isFullScreen,
        isRtl,
        isRendererSupported,
        loading,
        stageSize,
        vm,
        activeTabIndex,
        onActivateStageTab
    } = props;

    const tabClassNames = {
        tabs: guiStyles.tabs,
        tab: classNames(tabStyles.reactTabsTab, guiStyles.tab),
        tabList: classNames(tabStyles.reactTabsTabList, guiStyles.tabList),
        tabPanel: classNames(tabStyles.reactTabsTabPanel, guiStyles.tabPanel),
        tabPanelSelected: classNames(tabStyles.reactTabsTabPanelSelected, guiStyles.isSelected),
        tabSelected: classNames(tabStyles.reactTabsTabSelected, guiStyles.isSelected)
    };

    const [activeTab, setActiveTab] = useState(1);
    return (
        <Box
            className={classNames(
                styles.stageWrapper,
                {[styles.fullScreen]: isFullScreen}
            )}
            dir={isRtl ? 'rtl' : 'ltr'}
        >
            <Box className={styles.stageMenuWrapper}>
                <StageHeader
                    stageSize={stageSize}
                    vm={vm}
                />
            </Box>
            {/* TODO for now the activeTabIndex is not used.
            Check if I need this, and if not, why the tabs from the left side (code, costumes, sounds) needs it*/}
            {/* selectedIndex={activeTabIndex} */}
            {/* onSelect={onActivateStageTab} */}
            <Tabs
                forceRenderTabPanel
                className={tabClassNames.tabs}
                defaultIndex={1}
                selectedTabClassName={tabClassNames.tabSelected}
                selectedTabPanelClassName={tabClassNames.tabPanelSelected}
                onSelect={tab => {
                    onActivateStageTab(tab); 
                    setActiveTab(tab);
                }}
            >
                <TabList className={tabClassNames.tabList}>
                    <Tab className={classNames(tabClassNames.tab, styles.tab)}>
                        <img
                            draggable={false}
                            src={scratchCatIcon}
                        />
                        <FormattedMessage
                            defaultMessage="Scratch"
                            description="Button to get to the code panel"
                            id="gui.stageWrapper.scratchTab"
                        />
                    </Tab>
                    <Tab className={classNames(tabClassNames.tab, styles.tab)}>
                        <img
                            draggable={false}
                            src={javascriptIcon}
                        />
                        <FormattedMessage
                            defaultMessage="Leopard"
                            description="Button to get to the leopard renderer panel"
                            id="gui.stageWrapper.jsTab"
                        />
                    </Tab>
                </TabList>
                <TabPanel className={tabClassNames.tabPanel}>
                    <Box className={styles.stageCanvasWrapper}>
                        {
                            isRendererSupported ?
                                <Stage
                                    stageSize={stageSize}
                                    vm={vm}
                                    isRendered={activeTab == 0}
                                /> :
                                null
                        }
                    </Box>
                </TabPanel>
                <TabPanel className={tabClassNames.tabPanel}>
                    <Box className={styles.stageCanvasWrapper}>
                        <StageJSComponent stageSize={stageSize}/>
                    </Box>
                </TabPanel>
            </Tabs>
            {loading ? (
                <Loader isFullScreen={isFullScreen} />
            ) : null}
        </Box>
    );
};

StageWrapperComponent.propTypes = {
    isFullScreen: PropTypes.bool,
    isRendererSupported: PropTypes.bool.isRequired,
    isRtl: PropTypes.bool.isRequired,
    loading: PropTypes.bool,
    stageSize: PropTypes.oneOf(Object.keys(STAGE_DISPLAY_SIZES)).isRequired,
    vm: PropTypes.instanceOf(VM).isRequired
};

const mapStateToProps = state => ({
    activeTabIndex: state.scratchGui.editorTab.activeTabIndex,
});

const mapDispatchToProps = dispatch => ({
    onActivateStageTab: tab => dispatch(activateStageTab(tab)),
});

export default injectIntl(connect(
    mapStateToProps,
    mapDispatchToProps
)(StageWrapperComponent));
