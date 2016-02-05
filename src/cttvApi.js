var apijs = require("tnt.api");

var http = require("httpplease");
var promises = require('httpplease-promises');
var Promise = require('es6-promise').Promise;
var json = require("httpplease/plugins/json");
jsonHttp = http.use(json).use(promises(Promise));
http = http.use(promises(Promise));

var cttvApi = function () {

    var credentials = {
        token : "",
        appname : "",
        secret : ""
    };

    var config = {
        verbose: false,
        prefix: "https://www.targetvalidation.org/api/latest/"
    };

    var getToken = function () {
        var tokenUrl = _.url.requestToken(credentials);
        //console.log("TOKEN URL: " + tokenUrl);
        return jsonHttp.get({
            "url": tokenUrl
        });
    };

    var _ = {};
    _.call = function (myurl, callback, data) {
        // No auth
        if ((!credentials.token) && (!credentials.appname) && (!credentials.secret)) {
            console.log("    CttvApi running in non-authentication mode");
            if (data){ // post
                return jsonHttp.post({
                    "url": myurl,
                    "body": data
                });
            }
            return jsonHttp.get({
                "url" : myurl
            }, callback);
        }
        if (!credentials.token) {
            console.log("No credential token, requesting one...");

            return getToken()
                .then(function (resp) {
                    console.log("   ======> Got a new token: " + resp.body.token);
                    credentials.token = resp.body.token;
                    var headers = {
                        "Auth-token": resp.body.token
                    };
                    var myPromise;
                    if (data) { // post
                        myPromise = jsonHttp.post ({
                            "url": myurl,
                            "headers": headers,
                            "body": data
                        });
                    } else { // get
                        myPromise = jsonHttp.get ({
                            "url": myurl,
                            "headers": headers
                        }, callback);

                    }
                    return myPromise;

                });
        } else {
            console.log("Current token is: " + credentials.token);
            return jsonHttp.get({
                "url" : myurl,
                "headers": {
                    "Auth-token": credentials.token
                }
            }, callback).catch(function (err) {
                // Logic to deal with expired tokens
                if (err.status === 401){
                    console.log("     --- Received an api error -- Possibly the token has expired (401), so I'll request a new one: ");

                    credentials.token = "";
                    return _.call(myurl, callback, data);
                } else {
                    throw err;
                }
            });
        }
    };

    apijs(_)
        .getset(credentials)
        .getset(config);

    // URL object
    _.url = {};

    // prefixes
    var prefixFilterby = "public/evidence/filterby?";
    var prefixAssociations = "public/association/filterby?";
    var prefixSearch = "public/search?";
    var prefixGene = "private/target/";
    var prefixDisease = "private/disease/"; // updated from "efo" to "disease"
    var prefixToken = "public/auth/request_token?";
    var prefixAutocomplete = "private/autocomplete?";
    var prefixQuickSearch = "private/quicksearch?";
    var prefixExpression = "private/expression?";
    var prefixProxy = "proxy/generic/";
    var prefixTarget = "private/target/"; // this replaces prefixGene

    _.url.gene = function (obj) {
        return config.prefix + prefixGene + obj.gene_id;
    };

    _.url.target = function (obj) {
        return config.prefix + prefixTarget + obj.target_id;
    };

    _.url.disease = function (obj) {
        return config.prefix + prefixDisease + obj.code;
    };

    _.url.search = function (obj) {
        return config.prefix + prefixSearch + parseUrlParams(obj);
    };

    _.url.associations = function (obj) {
        return config.prefix + prefixAssociations + parseUrlParams(obj);
    };


    _.url.filterby = function (obj) {
        return config.prefix + prefixFilterby + parseUrlParams(obj);
    };


    _.url.requestToken = function (obj) {
        return config.prefix + prefixToken + "appname=" + obj.appname + "&secret=" + obj.secret;
    };

    _.url.autocomplete = function (obj) {
        return config.prefix + prefixAutocomplete + parseUrlParams(obj);
    };

    _.url.quickSearch = function (obj) {
        return config.prefix + prefixQuickSearch + parseUrlParams(obj);
    };

    _.url.expression = function (obj) {
        return config.prefix + prefixExpression + parseUrlParams(obj);
    };

    _.url.proxy = function (obj) {
        return config.prefix + prefixProxy + obj.url;
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
