var rest = require('./rest');
var version = require('../version');
var Q = require('Q');

function getFieldValueByName(fields, name)
{
	var field = getFieldByName(fields, name);
	if(field === null)
		return null;
	else
		return field.value;
}

function getFieldByName(fields, name)
{
	for (var i = 0; i < fields.length; i++) {
		var element = fields[i];
		if(element.name === name)
		{
			return element;
		}
	}
	
	return null;
}

function Issue(restData, repository)
{
	this.id = restData.id;
	this.entityId = restData.entityId;
	this.project = getFieldValueByName(restData.field, 'projectShortName');
	this.releasedOnPlatform = getFieldValueByName(restData.field, 'Released on platform');
	var stateValue = getFieldValueByName(restData.field, 'State'); 
    this.state = stateValue == null ? null : stateValue[0];
	this.text = getFieldValueByName(restData.field, 'summary');
	
	this.__loadVersions(getFieldValueByName(restData.field, 'Included in a build'));
	this.__repository = repository;
}

Issue.prototype.changeState = function changeStatePromoise(newState, notifyUsers)
{
    return this.__repository.changeState(this, newState, notifyUsers);
};

Issue.prototype.unassign = function unassignPromise() {
    return this.__repository.changeAssignee(this, 'Unassigned');
};

function YouTrackRepository(config) {
	this.config = config;
}

YouTrackRepository.prototype.getIssueById = function getIssueByIdPromise(id)
{
	var self = this;
	return rest.ytAuthPromise(self.config)
		.then(function(auth){
			return rest.ytRequestPromise(self.config, '/issue/', id, auth)
				.then(
					function(ticket){
						return new Issue(ticket, self);
					},
					function(fail){
						if(fail.responseCode && fail.responseCode === 404)
						{
							return null;
						}
					});
		});
};


YouTrackRepository.prototype.checkAndCreateBuild = function createBuildPromise(build)
{
	var self = this;
    if(!build.version.isValid)
        return Q(null);

	return rest.ytAuthPromise(self.config)
		.then(function(auth){
			return rest.ytCheckPromise(
				self.config, 
				'/admin/customfield/buildBundle/', 
				encodeURIComponent('Code Builds') + '/' + encodeURIComponent(build.version.tapas),
				auth,
				404)
			.then(function(doesnExist){
				if(doesnExist)
				{
					return rest.ytPutPromise(
						self.config, 
						'/admin/customfield/buildBundle/', 
						encodeURIComponent('Code Builds') + '/' + encodeURIComponent(build.version.tapas) + '?assembleDate=' + build.finished.valueOf(), 
						auth);
				}
			});		
		});
};

YouTrackRepository.prototype.getIssuesInVersions = function getIssuesInBuildsPromise(versions, projectsOrAdditionalFilter)
{
    var additionalFilter = '';
    if(typeof(projectsOrAdditionalFilter) === 'string')
        additionalFilter = projectsOrAdditionalFilter;
    else
        additionalFilter = getProjectFilter(projectsOrAdditionalFilter);
    return this.getIssuesByFilter(this.getFilter(versions, additionalFilter));
};

YouTrackRepository.prototype._getIssuesByFilterPaged = function getIssuesByFilterPagedPromise(filter, result)
{
    var self = this;
	return rest.ytAuthPromise(self.config)
		.then(function(auth){
			return rest.ytRequestPromise(
				self.config,
				'/issue',	
				'?filter=' + encodeURIComponent(filter) + '&max=200&after=' + result.length,
				auth
			)
			.then(function(issuesCompactData){
				if(issuesCompactData.issue == undefined)
					return result;
				for (var i = 0; i < issuesCompactData.issue.length; i++) {
					var element = issuesCompactData.issue[i];
					result.push(new Issue(element, self));
				}
                
                if(issuesCompactData.issue.length === 0)
    				return result;
                else
                    return self._getIssuesByFilterPaged(filter, result);
			})
		});
}

YouTrackRepository.prototype.getIssuesByFilter = function getIssuesByFilter(filter) {
    return this._getIssuesByFilterPaged(filter, []);
}

YouTrackRepository.prototype.changeState = function changeStatePromise(issue, newState, notify)
{
    var self = this;
    return rest.ytAuthPromise(self.config)
		.then(function(auth){
			return rest.ytPostPromise(
				self.config,
				'/issue/' + issue.id + '/execute',
				{'command' : 'State ' + newState, 'disableNotifications': !notify},
				auth);
		});
}

YouTrackRepository.prototype.changeAssignee = function changeAssigneePromuse(issue, newAssignee, notify)
{
    var self = this;
    return rest.ytAuthPromise(self.config)
		.then(function(auth){
			return rest.ytPostPromise(
				self.config,
				'/issue/' + issue.id + '/execute',
				{'command' : 'Assignee ' + newAssignee, 'disableNotifications': !notify},
				auth);
		});
};


module.exports = function createRepository(config)
{
	return new YouTrackRepository(config);
}