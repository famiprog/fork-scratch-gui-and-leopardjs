import React, { Children, JSX, ReactNode } from "react";
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
// @ts-ignore
import styles from './stage-wrapper.css';
// @ts-ignore
import tabStyles from 'react-tabs/style/react-tabs.css';
// @ts-ignore
import guiStyles from "../../../../components/gui/gui.css";
import { FormattedMessage, injectIntl } from 'react-intl';
// import { activateStageTab } from '../../reducers/stage-wrapper-tab.js';
// import { connect } from 'react-redux';

// @ts-ignore
import scratchCatIcon from './icon--scratch-cat.svg';
// @ts-ignore
import javascriptIcon from './icon--javascript.svg';
// import StageJSComponent from '../stage-js/stage-js.jsx'
// @ts-ignore
import classNames from 'classnames';
// @ts-ignore
import Box from '../../../../components/box/box.jsx';
// @ts-ignore
import StageJSComponent from "../../../../components/stage-js/stage-js.jsx";

export function StageWrapperComponentInject(props: { originalProps: any, children: ReactNode }) {
    const tabClassNames = {
        tabs: guiStyles.tabs,
        tab: classNames(tabStyles.reactTabsTab, guiStyles.tab),
        tabList: classNames(tabStyles.reactTabsTabList, guiStyles.tabList),
        tabPanel: classNames(tabStyles.reactTabsTabPanel, guiStyles.tabPanel),
        tabPanelSelected: classNames(tabStyles.reactTabsTabPanelSelected, guiStyles.isSelected),
        tabSelected: classNames(tabStyles.reactTabsTabSelected, guiStyles.isSelected)
    };
    return <Tabs
        forceRenderTabPanel
        className={tabClassNames.tabs}
        defaultIndex={0}
        selectedTabClassName={tabClassNames.tabSelected}
        selectedTabPanelClassName={tabClassNames.tabPanelSelected}
    // onSelect={tab => {
    //     onActivateStageTab(tab);
    //     setActiveTab(tab);
    // }}
    >
        <TabList className={tabClassNames.tabList}>
            {/* <Tab className={classNames(tabClassNames.tab, styles.tab)}> */}
            <Tab className={classNames(tabClassNames.tab)}>
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
            {/* <Tab className={classNames(tabClassNames.tab, styles.tab)}> */}
            <Tab className={classNames(tabClassNames.tab)}>
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
            {props.children}
        </TabPanel>
        <TabPanel className={tabClassNames.tabPanel}>
            <Box className={styles.stageCanvasWrapper}>
                <StageJSComponent stageSize={props.originalProps.stageSize} />
            </Box>
        </TabPanel>
    </Tabs>
}