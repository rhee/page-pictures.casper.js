#!/usr/bin/env casperjs

var casper = require('casper').create({
    //verbose: true,
    logLevel: "debug",
    pageSettings: { webSecurityEnabled: false }
});

var casper_utils_dump = require('utils').dump;

var config = {
    agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.94 Safari/537.36',
    timeout: 15000, /* 5s ? */
    minSize: 170000, /* 170k ? */
    minWidth: 1080,
    minHeight: 1080,
    minPixels: 1920 * 1080,
}

function casper_dump_indices(obj, tag) {
    if (obj) {
		var indices = [];
		for (var i in obj) {
			indices.push(i);
		}
		casper.echo('=== dump_indices ===: ' + tag);
		casper_utils_dump(indices);
    }
}

function casper_hash_string(str) {
	var hashCode = function (str) {
		var hash = 0;
		if (str.length == 0) return hash;
		for (i = 0; i < str.length; i++) {
			char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		return hash;
	}, num = hashCode(str);
	return (num < 0 ? (0xFFFFFFFF + num + 1) : num).toString(16);
}

function casper_download_image(src, mimeType) {

	var basename = src.split(/[?#]/).shift().split(/[\/]/).pop(), /* basename() */
		filename = '' + basename + '_' + casper_hash_string(src) + '.png';
	casper.echo('casper_download_image: ' + src + ' ' + filename);
	try {
		casper.download(src, filename);
	} catch (e) {
		/* */
	}

}

function casper_short_url(url) {
	if ( url.length > 200 ) {
		return url.substr(0,200) + ' ...';
	} else {
		return url;
	}
}

function casper_dump_backtrace(msg, backtrace) {
    casper.echo('backtrace: ' + msg);
    for (var i = 0; i < backtrace.length; i++) {
		var f = backtrace[i];
		casper.echo('    ' + f.file + ':' + f.line + ': ' + f.function);
    }
}

//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

var urls = casper.cli.args.slice(0);
var casper_image_resources = {};
var images = {};

casper.options.waitTimeout = config.timeout;
casper.userAgent(config.agent);

casper.on('remote.message', function (message) { this.echo('message: ' + message) });

casper.on('error', function (msg, backtrace) { casper_dump_backtrace('error: ' + msg, backtrace) });//this.echo('error: '+msg); dump(backtrace[0]) });
casper.on('page.error', function (msg, backtrace) { casper_dump_backtrace('page.error: ' + msg, backtrace) });//this.echo('page.error:'+msg); dump(backtrace[0]) });
casper.on('complete.error', function (err) { this.echo('complete.error: ' + JSON.stringify(err)) });

casper.on('resource.error', function (resourceError) {
	//var errorCode = resourceError.errorCode,
	//	errorString = resourceError.errorString,
	//	url = resourceError.url,
	//	id = resourceError.id;
	this.echo('resource.error: ' + JSON.stringify(resourceError));
})

casper.on('step.error', function (err) {
	this.echo('step.error: ' + JSON.stringify(err));
})

casper.on('resource.received', function (resource) {

	/// collect url into casper_image_resources, if contentType bodySize matches

	//this.echo('resource.recevied: ' + resource.contentType + ' ' + resource.bodySize + ' ' + casper_short_url(resource.url));

    if (/^image\//.test(resource.contentType)) {

		if (typeof resource.bodySize == 'undefined' || resource.bodySize > config.minSize) {

			//this.echo('resource.recevied: ' + resource.contentType + ' ' + resource.bodySize + ' ' + casper_short_url(resource.url));
			casper_image_resources[resource.url] = resource.contentType;

		}

    }

});

casper.start().eachThen(urls, function (response) {
    this.thenOpen(response.data);

	this.then(function () {

		this.evaluate(function (resources, config) {

			window.collected_images = {};

			for (url in resources) {
				!function (url, mimeType) {
					var img = new Image();
					img.onLoad = function () {
						if (img.width >= config.minWidth &&
							img.height >= config.minHeight &&
							img.width * img.height >= config.minPixels) {
							window.collected_images[url] = mimeType;
						}
					}
					img.src = url;
					if (img.complete || img.readyState === 4) {
						img.onLoad();
					}
				} (url, resources[url]);
			}

		}, casper_image_resources, config);

	});

	this.then(function () {

		var images = this.evaluate(function () { return window.collected_images });

		this.echo('end of scan: images=' + JSON.stringify(images));

		for (url in images) {
			var mimeType = images[url];
			casper_download_image(url, mimeType);
		}

	});

});

casper.run()
// vim: se ft=javascript st=4 ts=8 sts=4
