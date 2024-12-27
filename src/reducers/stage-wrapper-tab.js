const ACTIVATE_STAGE_TAB = 'scratch-gui/navigation/ACTIVATE_STAGE_TAB';

// Constants use numbers to make it easier to work with react-tabs
const SCRATCH_RENDERER_TAB_INDEX = 0;
const JS_RENDERER_TAB_INDEX = 1;

const initialState = {
    activeTabIndex: SCRATCH_RENDERER_TAB_INDEX
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case ACTIVATE_STAGE_TAB:
        return Object.assign({}, state, {
            activeTabIndex: action.activeTabIndex
        });
    default:
        return state; 
    }
};

const activateStageTab = function (tab) {
    return {
        type: ACTIVATE_STAGE_TAB,
        activeTabIndex: tab
    };
};

export {
    reducer as default,
    initialState as stageTabInitialState,
    activateStageTab,
    SCRATCH_RENDERER_TAB_INDEX,
    JS_RENDERER_TAB_INDEX
};
