var Q = require('Q');
var http = require('http');
var url = require('url');
var error = require('../RestError');

var ytRestAPIPath = 'rest';
function buildParams(locator, params)
{
	var result = '';
	if(locator)
	{
		result = '?locator=';
		var first = true;
		for(var propertyName in locator)
		{
			if(!first)
				result += ',';
			result += propertyName + ':' + locator[propertyName];
			first = false;
		}
	}
	

	if(!params)
		return result;

	if(result === '')
		result = '?';
	var first = true;
	for(var propertyName in params)
	{
		if(!first)
			result += '&';
		result += propertyName + '=' + params[propertyName];
		first = false;
	}
	return result;
}

function buildPostParams(params)
{
	if(!params)
		return '';
	var result = '';
	var first = true;
	for(var name in params)
	{
		if(!first)
			result += '&';
		first = false;
		result += encodeURIComponent(name) + '=' + encodeURIComponent(params[name]);
	}
	
	return result;
}

module.exports.ytAuthPromise = function(config)
{
	var deferred = Q.defer();
	var parsedUrl = url.parse(config.server);
	var req = http.request({
		hostname: parsedUrl.hostname,
		method: 'POST',
		port: parsedUrl.port,
		path: parsedUrl.path + ytRestAPIPath + '/user/login',
		headers: {'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'Connection': 'close'}
	}, function(res){
		if(res.statusCode != 200)
		{
			deferred.reject(new Error('Request to ' + parsedUrl.path + ytRestAPIPath + 'user/login?login=' + config.username + '&password=***** failed with ' + res.statusCode));
		}
		var cookie = res.headers['set-cookie'];
		
		res
		.on('data', function(){})
		.on('end', function(){
				if(res.statusCode != 200)
					return;
				deferred.resolve(cookie);
			});
		
	}).on('error', function(e) {
		deferred.reject(new Error(e.message));
	});
	
	req.write('login=' + encodeURIComponent(config.username) + '&password=' + encodeURIComponent(config.password));
	req.end();
	
	return deferred.promise;
};

module.exports.ytPutPromise = function(config, entityPath, qString, auth)
{
	var deferred = Q.defer();
	var parsedUrl = url.parse(config.server);
	var req = http.request({
		hostname: parsedUrl.hostname,
		method: 'PUT',
		port: parsedUrl.port,
		path: parsedUrl.path + ytRestAPIPath + entityPath + qString,
		headers: {'Accept': 'application/json', 'Connection': 'close', 'Cookie': auth}
	}, function(res){
		if(res.statusCode < 200 || res.statusCode >= 300)
		{
			deferred.reject(new Error('Request to ' + parsedUrl.path + ytRestAPIPath + entityPath + qString + ' failed with ' + res.statusCode));
		}
		
		// console.log('status %s location %s', res.statusCode, res.headers['location']);
		var location = res.headers['location'];
		var data = '';
		res
		.on('data', function(c){ data += c;})
		.on('end', function(){
				if(res.statusCode < 200 || res.statusCode >= 300)
					return;
				deferred.resolve(location);
			});
		
	}).on('error', function(e) {
		// console.log('error');
		deferred.reject(new Error(e.message));
	});
	
	req.write('');
	req.end();
	
	return deferred.promise;
}

module.exports.ytPostPromise = function(config, entityPath, params, auth)
{
	var deferred = Q.defer();
	var parsedUrl = url.parse(config.server);
	var postParams = buildPostParams(params);
	var req = http.request({
		hostname: parsedUrl.hostname,
		method: 'POST',
		port: parsedUrl.port,
		path: parsedUrl.path + ytRestAPIPath + entityPath,
		headers: {'Accept': 'application/json', 'Connection': 'close', 'Cookie': auth, 'Content-Type': 'application/x-www-form-urlencoded'}
	}, function(res){
		if(res.statusCode < 200 || res.statusCode >= 300)
		{
			console.log('post err');
		}
		
		var data = '';
		res
		.on('data', function(c){ data += c;})
		.on('end', function(){
			if(res.statusCode < 200 || res.statusCode >= 300)
			{
				console.log(postParams);
				deferred.reject(new Error('POST Request to ' + parsedUrl.path + ytRestAPIPath + entityPath + ' failed with ' + res.statusCode + ' ' + data.value));
				return;		
			}
			deferred.resolve(data);
		});
		
	}).on('error', function(e) {
		console.log('error');
		deferred.reject(new Error(e.message));
	});
	
	req.write(postParams);
	req.end();
	
	return deferred.promise;
}

module.exports.ytRequestPromise = function(config, entityPath, qString, auth)
{
	var deferred = Q.defer();
	var parsedUrl = url.parse(config.server);
	http.get({
		hostname: parsedUrl.hostname,
		port: parsedUrl.port,
		path: parsedUrl.path + ytRestAPIPath + entityPath + qString,
		headers: {'Accept': 'application/json', 'Cookie': auth}
	}, function(res){
		res.setEncoding('utf8');
		var jsonResponse = '';
		res
			.on('data', function (chunk) {
				jsonResponse += chunk;
			})
			.on('end', function(){
				if(res.statusCode != 200)
				{
					deferred.reject(error(
						parsedUrl.path + ytRestAPIPath + entityPath + qString, 
						res.statusCode, 
						jsonResponse
						));
				}
					
				deferred.resolve(JSON.parse(jsonResponse));
			});
	}).on('error', function(e) {
		deferred.reject(new Error(e.message));
	});
	
	return deferred.promise;
};

module.exports.ytCheckPromise = function(config, entityPath, qString, auth, expectCode)
{
	var deferred = Q.defer();
	var parsedUrl = url.parse(config.server);
	http.get({
		hostname: parsedUrl.hostname,
		port: parsedUrl.port,
		path: parsedUrl.path + ytRestAPIPath + entityPath + qString,
		headers: {'Accept': 'application/json', 'Cookie': auth}
	}, function(res){
		
		res.setEncoding('utf8');
		var jsonResponse = '';
		res
			.on('data', function (chunk) {
				jsonResponse += chunk;
			})
			.on('end', function(){
				deferred.resolve(res.statusCode == expectCode);
			});
	}).on('error', function(e) {
		deferred.reject(new Error(e.message));
	});
	
	return deferred.promise;
};
