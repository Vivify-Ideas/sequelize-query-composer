const queryConfig = require('./SequelizeQueryComposerConfig');
const pick = require('lodash/pick');
const omit = require('lodash/omit');
const intersection = require('lodash/intersection');
const isEmpty = require('lodash/isEmpty');
const compact = require('lodash/compact');

module.exports = class Search {
    constructor(model, mappedAssociations = {}) {
        this.model = model;
        this.pagination = {};
        this.mappedAssociations = mappedAssociations;
        this.fieldNames = queryConfig.fieldNames;
    }

    async searchAllFromQuery(query) {
        const jsonQuery = this.getQueryParams(query);
        return this.searchAll(jsonQuery);
    }

    async searchAll(jsonQuery) {
        const data = await this.model.findAll(jsonQuery);
        return data;
    }

    async searchAllWithPagination(jsonQuery) {
        this.setPaginationFromQuery(jsonQuery);
        const data = await this.model.findAll({
            ...jsonQuery,
            limit: this.pagination.pageSize + 1,
        });

        const pagination = this.getPagination(data);

        return {
            data: data.slice(0, this.pagination.pageSize),
            pagination
        };
    };

    setPaginationFromQuery(jsonQuery) {
        const limit = Number(jsonQuery.limit) || this.fieldNames.defaultPageSize;
        const pageFrom = Number(jsonQuery.offset) || 0;
        const offset = pageFrom * limit;

        this.pagination = {
            limit,
            offset,
            pageFrom,
            pageSize: limit,
        };
    }

    getPagination(data) {
        const hasNext = data.length > this.pagination.pageSize;
        const hasPrevious = this.pagination.pageFrom > 0;

        return {
            previousPage: hasPrevious ? this.pagination.pageFrom - 1 : null,
            nextPage: hasNext ? this.pagination.pageFrom + 1 : null,
            pageSize: this.pagination.pageSize,
        };
    }

    getQueryParams(parsedQuery) {
        if (!parsedQuery) {
            return null;
        }

        if (parsedQuery.shouldConstructQuery === false) {
            return parsedQuery;
        }

        const whereConditions = this.extractWhereConditions(parsedQuery);
        const searchString = this.extractSearchString(parsedQuery);
        const mergedWhereParams = this.mergeParams(whereConditions, searchString);

        const includeAssociations = this.extractAssociations(parsedQuery);
        const attributesToSelect = this.extractAttributes(parsedQuery);
        const sortConditions = this.extractSortAttributes(parsedQuery);
        const paginationConditions = this.extractPaginationAttributes(parsedQuery);

        return {
            where: mergedWhereParams,
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

    extractSearchString(parsedQuery) {
        const filter = parsedQuery[this.fieldNames.filter];
        if (!filter) {
            return null;
        }

        let attributes = this.model.rawAttributes;
        if (this.model.allowedFields) {
            attributes = pick(attributes, this.model.allowedFields);
        }

				let search = Object.keys(attributes).map(key => ({
					[key]: {$like: `%${filter}%`},
				}));

				return { $or: [...search] };
		}

    mergeParams(firstParams = null, secondParams = null) {
        if (isEmpty(firstParams) || isEmpty(secondParams)) {
            return isEmpty(firstParams) ? secondParams : firstParams;
        }

		if (secondParams['$or']) {
			return {
				$or: [
					...secondParams['$or'],
					...Object.keys(firstParams).map(key => ({
						[key]: firstParams[key]
					}))
				]
			};
		}

		return Object.keys(firstParams).reduce((acc, key) => {
			const param = secondParams[key];

			if (param) {
				return {
					...acc,
					[key]: {
						$or: [firstParams[key], param],
					},
				};
			}

			return acc;
		}, {});
	}

    splitByAndFilter(string, delimiter) {
        return string.split(delimiter).filter(Boolean);
    };

    getAllModelFields() {
        return Object.keys(this.model.rawAttributes);
    }

    getOnlyModelFields(fields) {
        return intersection(fields, this.getAllModelFields());
    }

    getModelPk() {
        return this.model.primaryKeyAttributes[0] || 'id';
    }
};
