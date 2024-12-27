const UPDATE = 'scratch-gui/stage-js-files-version/UPDATE';

const initialState = 0;

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case UPDATE:
        return state + 1;
    default:
        return state;
    }
};

const updateStageJsFilesVersion = function () {
    return {
        type: UPDATE
    };
};

export {
    reducer as default,
    initialState as stageJsFilesVersionInitialState,
    updateStageJsFilesVersion
};