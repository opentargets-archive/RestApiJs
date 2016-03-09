var cttvApi = require("../../index.js");

var api = cttvApi()
    .prefix("http://test.targetvalidation.org:8008/api/latest/")
    .appname("cttv-web-app")
    .secret("2J23T20O31UyepRj7754pEA2osMOYfFK")
    .expiry(1)
    .verbose(true);

var url = api.url.associations({
    target: "ENSG00000102780"
});

api.call(url)
    .then (function (resp) {
        console.log(resp.body.status);
        setTimeout(function () {
            console.log("second call...");
            api.call(url)
                .then (function (resp) {
                    console.log(resp.body.status);
                });
        }, 2000);
    })
    .catch(function (err) {
        console.log("ERR REceived");
        console.log(err);
    });

console.log(url);
