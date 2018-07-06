var apijs = require("tnt.api");

var http = require("httpplease");
var promises = require('httpplease-promises');
var withcredentials = require('./withcredentials.js');
var Promise = require('es6-promise').Promise;
var json = require("httpplease/plugins/json");
jsonHttp = http.use(withcredentials).use(json).use(promises(Promise));
var jsonreq = require("httpplease/plugins/jsonrequest");
jsonReqHttp = http.use(withcredentials).use(jsonreq).use(promises(Promise));
// http = http.use(promises(Promise));
var structure = require("./structure.js");

var cttvApi = function () {

    var req; // can be json or not

    var credentials = {
        token : undefined, // is a promise or a string
        appname : "",
        secret : "",
        expiry : undefined
    };

    var config = {
        verbose: false,
        prefix: "https://www.targetvalidation.org/api/",
        version: "1.2",
        format: "json"
    };

    var getToken = function () {
        var tokenUrl = _.url.requestToken(credentials);
        credentials.token = jsonHttp.get({
            "url": tokenUrl
        });
        return credentials.token;
    };

    var _ = {};
    _.call = function (myurl, data, format) {
        // Response format json or not
        if (!format) {
            format = "json";
        }
        if (format === "json") {
            req = jsonHttp;
        } else {
            req = jsonReqHttp;
        }

        // No auth
        if ((!credentials.token) && (!credentials.appname) && (!credentials.secret)) {
            if (config.verbose) {
                console.log("    CttvApi running in non-authentication mode");
            }

            if (data){ // post
                return req.post({
                    "url": myurl,
                    "body": data,
                    "headers": {
                        "Accept": "*/*"
                    }
                });
            }

            return req.get({
                "url" : myurl,
                "headers": {
                    "Accept": "*/*"
                }
            });
        }

        // Auth - but not token
        if (!credentials.token) {
            if (config.verbose) {
                console.log("No credential token, requesting one...");
            }

            return getToken()
                .then(callApi)
                .catch(catchErr);
        // Auth & token
        } else {
            if (config.verbose) {
                console.log("Current token is: " + credentials.token);
            }
            var tokenPromise = new Promise (function (resolve) {
                resolve ({
                    body: {
                        token: credentials.token
                    }
                });
            });
            if (typeof credentials.token !== "string") { // The token is still a string
                tokenPromise = credentials.token;
            }

            return tokenPromise
                // .then (function () {
                //     return callApi
                //     // return jsonHttp.get({
                //     //     "url" : myurl,
                //     //     "headers": {
                //     //         "Auth-token": credentials.token
                //     //     }
                //     // })
                //     .catch(catchErr);
                .then (callApi)
                .catch(catchErr);
                // });
        }

        function callApi (resp) {
            if (config.verbose) {
                console.log("   ======> Got a new token: " + resp.body.token);
            }
            credentials.token = resp.body.token;
            var headers = {
                "Auth-token": resp.body.token
            };
            var myPromise;
            if (data) { // post
                myPromise = req.post ({
                    "url": myurl,
                    "headers": headers,
                    "body": data
                });
            } else { // get
                myPromise = req.get ({
                    "url": myurl,
                    "headers": headers
                });

            }
            return myPromise;
        }

        function catchErr (err) {
            // Logic to deal with expired tokens
            switch (err.status) {
                case (401) : // Probably wrong credentials
                if (err.body.message === "authentication credentials not valid") {
                    if (config.verbose) {
                        console.log("    --- Received an api error -- Possibly the credentials are wrong (" + err.status + "), so I'll make the call without credentials");
                    }
                    console.warn('wrong authentication appname (' + credentials.appname + ') or secret (' + credentials.secret + ') -- I will remove the credentials and try the same call again');
                    // Remove credentials and run in non-authentication mode
                    credentials.appname = undefined;
                    credentials.secret = undefined;
                    credentials.token = undefined;
                    return _.call(myurl, data);
                }
                break;

                case (419) : // Token expired
                if (config.verbose) {
                    console.log("     --- Received an api error -- Possibly the token has expired (" + err.status + "), so I'll request a new one");
                }
                if (typeof credentials.token === "string" ) {
                    credentials.token = undefined;
                }
                return _.call(myurl, data);

                case (429) : // Too many calls
                if (config.verbose) {
                    console.log("     --- Received an api error -- Probably too many calls made to the api (" + err.status + "), so I'll wait some time to fetch the data");
                }
                var delayedPromise = new Promise (function (resolve) {
                    setTimeout(function (){
                        if (config.verbose) {
                            console.log(" *** trying again after receiving a too many requests error");
                        }
                        resolve(_.call(myurl, data));
                    }, 10000);
                });
                return delayedPromise;

                default:
                throw err;
            }
        }

    };

    apijs(_)
        .getset(credentials)
        .getset(config);


    // Utils
    _.utils = {};
    _.utils.flat2tree = structure.flat2tree;

    // URL object
    _.url = {};

    // prefixes
    var prefixFilterby = "public/evidence/filter?";
    var prefixAssociations = "public/association/filter?";
    var prefixSearch = "public/search?";
    var prefixGene = "private/target/";
    var prefixDisease = "private/disease/"; // updated from "efo" to "disease"
    var prefixToken = "public/auth/request_token?";
    var prefixAutocomplete = "private/autocomplete?";
    var prefixQuickSearch = "private/quicksearch?";
    var prefixExpression = "private/target/expression?";
    var prefixProxy = "proxy/generic/";
    var prefixTarget = "private/target/"; // this replaces prefixGene
    var prefixTargetRelation = "private/relation/target/";
    var prefixDiseaseRelation = "private/relation/disease/";
    var prefixLogSession = "private/utils/logevent";
    var prefixMultiSearch = "private/besthitsearch?";
    var prefixStats = "public/utils/stats";
    var prefixTargetsEnrichment = "private/enrichment/targets?";

    _.url.gene = function (obj) {
        return config.prefix + config.version + "/" + prefixGene + obj.gene_id;
    };

    _.url.target = function (obj) {
        if (obj && obj.target_id) {
            // One target
            return config.prefix + config.version + "/" + prefixTarget + obj.target_id;
        }
        // Multiple targets (optionally we can specify specific fields)
        return config.prefix + config.version + "/" + prefixTarget + parseUrlParams(obj);
    };

    _.url.disease = function (obj) {
        return config.prefix + config.version + "/" + prefixDisease + obj.code;
    };

    _.url.search = function (obj) {
        return config.prefix + config.version + "/" + prefixSearch + parseUrlParams(obj);
    };

    _.url.associations = function (obj) {
        return config.prefix + config.version + "/" + prefixAssociations + parseUrlParams(obj);
    };

    _.url.filterby = function (obj) {
        return config.prefix + config.version + "/" + prefixFilterby + parseUrlParams(obj);
    };

    _.url.requestToken = function (obj) {
        return config.prefix + config.version + "/" + prefixToken + "app_name=" + obj.appname + "&secret=" + obj.secret + (credentials.expiry ? ("&expiry=" + credentials.expiry) : "" );
    };

    _.url.autocomplete = function (obj) {
        return config.prefix + config.version + "/" + prefixAutocomplete + parseUrlParams(obj);
    };

    _.url.quickSearch = function (obj) {
        return config.prefix + config.version + "/" + prefixQuickSearch + parseUrlParams(obj);
    };

    _.url.expression = function (obj) {
        return config.prefix + config.version + "/" + prefixExpression + parseUrlParams(obj);
    };

    _.url.bestHitSearch = function (obj) {
        return config.prefix + config.version + "/" + prefixMultiSearch + parseUrlParams(obj);
    };

    _.url.proxy = function (obj) {
        return config.prefix + config.version + "/" + prefixProxy + obj.url;
    };

    _.url.targetRelation = function(obj){
        return config.prefix + config.version + "/" + prefixTargetRelation + obj.id + '?' + parseUrlParams(obj);
    };

    _.url.diseaseRelation = function(obj){
        var id = obj.id;
        delete(obj.id);
        return config.prefix + config.version + "/" + prefixDiseaseRelation + id + "?" + parseUrlParams(obj);
    };

    _.url.logSession = function (obj) {
        return config.prefix + config.version + "/" + prefixLogSession + '?' + parseUrlParams(obj);
    };

    _.url.stats = function () {
        return config.prefix + config.version + "/" + prefixStats;
    };

    _.url.targetsEnrichment = function (obj) {
        return config.prefix + config.version + "/" + prefixTargetsEnrichment + parseUrlParams(obj);
    };

    /**
    * This takes a params object and returns the params concatenated in a string.
    * If a parameter is an array, it adds each item, all with hte same key.
    * Example:
    *   obj = {q:'braf',size:20,filters:['id','pvalue']};
    *   console.log( parseUrlParams(obj) );
    *   // prints "q=braf&size=20&filters=id&filters=pvalue"
    */
    var parseUrlParams = function(obj){
        var opts = [];
        for(var i in obj){
            if( obj.hasOwnProperty(i)){
                if(obj[i].constructor === Array){
                    opts.push(i+"="+(obj[i].join("&"+i+"=")));
                } else {
                    opts.push(i+"="+obj[i]);
                }
            }
        }
        return opts.join("&");
    };


    return _;
};

module.exports = cttvApi;
