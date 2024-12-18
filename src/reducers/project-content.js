const SET_PROJECT_CONTENT = 'scratch-gui/ProjectContent/SET_PROJECT_CONTENT';

const initialState = {
    projectContent: undefined
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case SET_PROJECT_CONTENT:
        return {
            projectContent: action.projectContent
        };
    default:
        return state;
    }
};

const setProjectContent = function (projectContent) {
    return {
        type: SET_PROJECT_CONTENT,
        projectContent: projectContent
    };
};

export {
    reducer as default,
    initialState as projectContentInitialState,
    setProjectContent
};