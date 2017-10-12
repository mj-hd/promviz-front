'use strict';

import _ from 'lodash';
import EventEmitter from 'events';

import AppDispatcher from '../appDispatcher';
import AppConstants from '../appConstants';

const CHANGE_EVENT = 'change';

const noticeMap = ['info', 'warning', 'danger'];
const defaultNoticeFilter = ['normal', 'info', 'warning', 'danger'];
const noNoticeFilter = ['normal', 'info', 'warning', 'danger'];

const defaultFilters = {
  rps: { value: -1 },
  error: { value: -1 },
  clas: { value: [] },
  noticeConnection: { value: defaultNoticeFilter },
  noticeNode: { value: defaultNoticeFilter }
};

const noFilters = {
  rps: { value: -1 },
  error: { value: -1 },
  clas: { value: [] },
  noticeConnection: { value: noNoticeFilter },
  noticeNode: { value: noNoticeFilter }
};

const noticePasses = (object, value) => {
  if (!object.notices || object.notices.length === 0) {
    return _.some(value, v => v === 'normal');
  }
  return !_.every(value, v => _.every(object.notices, notice => notice.severity !== noticeMap.indexOf(v)));
};

const store = {
  filters: {
    rps: {
      name: 'rps',
      type: 'connection',
      passes: (object, value) => object.volumeTotal >= value,
      value: -1
    },
    error: {
      name: 'error',
      type: 'connection',
      passes: (object, value) => (value === -1 && !object.volumePercent.danger) || object.volumePercent.danger >= value,
      value: -1
    },
    clas: {
      name: 'clas',
      type: 'node',
      passes: (object, value) => value.length <= 0 || value.indexOf(object.class || '') >= 0,
      value: []
    },
    // TODO: merge notice filters
    noticeConnection: {
      name: 'noticeConnection',
      type: 'connection',
      passes: noticePasses,
      value: []
    },
    noticeNode: {
      name: 'noticeNode',
      type: 'node',
      passes: noticePasses,
      value: [] // should have same value as noticeConnection
    }

  },
  states: {
    rps: [
      {
        name: 'high(>1000)',
        value: 1000
      },
      {
        name: '(>300)',
        value: 300
      },
      {
        name: '(>5)',
        value: 5
      },
      {
        name: 'all',
        value: -1
      }
    ],
    error: [
      {
        name: 'high(>10)',
        value: 0.10
      },
      {
        name: '(>5)',
        value: 0.05
      },
      {
        name: '(>1)',
        value: 0.01
      },
      {
        name: 'all',
        value: -1
      }
    ]
  }
};

const resetDefaults = function () {
  _.mergeWith(store.filters, defaultFilters, (obj, src) => {
    if (_.isArray(obj)) {
      return src;
    }
    return undefined;
  });
};

const clearFilters = function () {
  _.mergeWith(store.filters, noFilters, (obj, src) => {
    if (_.isArray(obj)) {
      return src;
    }
    return undefined;
  });
};

resetDefaults();

class FilterStore extends EventEmitter {
  constructor () {
    super();
    this.requests = {};

    AppDispatcher.register((payload) => {
      const action = payload.action;
      switch (action.actionType) {
      case AppConstants.ActionTypes.UPDATE_FILTER:
        this.updateFilters(action.data);
        this.emit(CHANGE_EVENT);
        break;
      case AppConstants.ActionTypes.UPDATE_DEFAULT_FILTERS:
        this.updateDefaultFilters(action.data);
        this.emit(CHANGE_EVENT);
        break;
      case AppConstants.ActionTypes.RESET_FILTERS:
        resetDefaults();
        this.emit(CHANGE_EVENT);
        break;
      case AppConstants.ActionTypes.CLEAR_FILTERS:
        clearFilters();
        this.emit(CHANGE_EVENT);
        break;
      default:
        return true;
      }
      return true;
    });
  }

  addChangeListener (cb) {
    this.on(CHANGE_EVENT, cb);
  }

  removeChangeListener (cb) {
    this.removeListener(CHANGE_EVENT, cb);
  }

  getDefaultFilters () {
    return defaultFilters;
  }

  getFilters () {
    return store.filters;
  }

  getFiltersArray () {
    return _.map(store.filters, filter => _.clone(filter));
  }

  getStates () {
    return store.states;
  }

  getChangedFilters () {
    return _.filter(store.filters, filter => filter.value !== defaultFilters[filter.name].value);
  }

  getStepFromValue (name) {
    const index = _.findIndex(store.states[name], step => step.value === store.filters[name].value);
    if (index === -1) {
      return _.findIndex(store.states[name], step => step.value === defaultFilters[name].value);
    }
    return index;
  }

  updateFilters (filters) {
    Object.keys(filters).forEach((filter) => {
      store.filters[filter].value = filters[filter];
    });
  }

  updateDefaultFilters (defaults) {
    _.merge(defaultFilters, defaults);
  }

  isLastClass (clas) {
    return store.filters.clas.value.length === 1 && store.filters.clas.value.indexOf(clas) === 0;
  }

  isLastNotice (notice) {
    return store.filters.noticeNode.value.length === 1 && store.filters.noticeNode.value.indexOf(notice) === 0;
  }

  isDefault () {
    return _.every(store.filters, filter => filter.value === defaultFilters[filter.name].value);
  }

  isClear () {
    return _.every(store.filters, filter => filter.value === noFilters[filter.name].value);
  }
}

const filterStore = new FilterStore();

export default filterStore;
