const assign = require('lodash/assign');

const DEFAULT_FIELD_NAMES = {
    sortBy: 'sort_by',
    sortDirection: 'sort_direction',

    pageFrom: 'page_from',
    pageSize: 'page_size',

    details: 'details',
    props: 'props',
    filter: 'filter',
    filterExcludeId: 'filter_exclude_id',
    sortByDelimiter: ',',
    attributesDelimiter: ',',
    associationDelimiter: ',',
    defaultSortDirection: 'DESC',
    defaultPageSize: 50,
};

class SequelizeQueryComposerConfig {

    constructor() {
        this.fieldNames = DEFAULT_FIELD_NAMES;
    }

    setConfig(globalConfig) {
        this.fieldNames = assign({}, DEFAULT_FIELD_NAMES, globalConfig);
    }
}

const queryConfig = new SequelizeQueryComposerConfig();
module.exports = queryConfig;
