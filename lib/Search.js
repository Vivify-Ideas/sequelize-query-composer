const queryConfig = require('./SequelizeQueryComposerConfig');
const pick = require('lodash/pick');
const omit = require('lodash/omit');
const intersection = require('lodash/intersection');
const compact = require('lodash/compact');

module.exports = class Search {
    constructor(model, mappedAssociations = {}) {
        this.model = model;
        this.pagination = {};
        this.mappedAssociations = mappedAssociations;
        this.fieldNames = queryConfig.fieldNames;
    }

    async searchAll(query) {
        const queryParams = this.getQueryParams(query);
        return this.searchAllWithPagination(queryParams);
    }

    async searchAllWithPagination(query) {
        const data = await this.model.findAll({
            ...query,
            pageSize: this.pagination.pageSize + 1,
        });

        const hasNext = data.length > this.pagination.pageSize - 1;
        const hasPrevious = this.pagination.pageFrom > 0;

        return {
            data,
            pagination: {
                previousPage: hasPrevious ? this.pagination.pageFrom - 1 : null,
                nextPage: hasNext ? this.pagination.pageFrom + 1 : null,
                pageSize: this.pagination.pageSize,
            },
        };
    };

    getQueryParams(parsedQuery) {
        const whereConditions = this.extractWhereConditions(parsedQuery);
        const includeAssociations = this.extractAssociations(parsedQuery);
        const attributesToSelect = this.extractAttributes(parsedQuery);
        const sortConditions = this.extractSortAttributes(parsedQuery);
        const paginationConditions = this.extractPaginationAttributes(parsedQuery);

        return {
            where: whereConditions,
            order: sortConditions,
            attributes: attributesToSelect,
            include: includeAssociations,
            ...paginationConditions,
        };
    };

    extractPaginationAttributes(parsedQuery) {
        const limit = Number(parsedQuery[this.fieldNames.pageSize]) || this.fieldNames.defaultPageSize;
        const pageFrom = Number(parsedQuery[this.fieldNames.pageFrom]) || 0;
        const offset = pageFrom * limit;

        this.pagination = {
            limit,
            offset,
            pageFrom,
            pageSize: limit,
        };

        return {
            offset,
            limit,
        };
    };

    extractSortAttributes(parsedQuery) {
        const querySortByString = parsedQuery[this.fieldNames.sortBy] || this.getModelPk();
        const querySortDirections = parsedQuery[this.fieldNames.sortDirection] || this.fieldNames.defaultSortDirection;

        const sortBy = this.splitByAndFilter(querySortByString, this.fieldNames.sortByDelimiter);
        let sortDirection = this.splitByAndFilter(querySortDirections, this.fieldNames.sortByDelimiter);

        return sortBy.map((field, index) => {
            return [field, sortDirection[index] || querySortDirections];
        });
    };

    extractAttributes(parsedQuery) {
        const attributes = parsedQuery.props;
        if (!attributes) {
            return null;
        }
        let fields = this.splitByAndFilter(attributes, this.fieldNames.attributesDelimiter);

        return this.getOnlyModelFields(fields);
    };

    extractWhereConditions(parsedQuery) {
        let whereConditions = omit(parsedQuery, Object.values(this.fieldNames));

        return pick(whereConditions, this.getAllModelFields());
    };

    extractAssociations(parsedQuery) {
        if (!parsedQuery[this.fieldNames.details]) {
            return null;
        }
        const associationsNames = this.splitByAndFilter(parsedQuery[this.fieldNames.details], this.fieldNames.associationDelimiter);

        return compact(associationsNames.map(associationName => this.mappedAssociations[associationName]));
    };

    splitByAndFilter(string, delimiter) { return string.split(delimiter).filter(Boolean); };
    getAllModelFields() { return Object.keys(this.model.rawAttributes); }
    getOnlyModelFields(fields) { return intersection(fields, this.getAllModelFields()); }
    getModelPk() { return this.model.primaryKeyAttributes[0] || 'id'; }
};
