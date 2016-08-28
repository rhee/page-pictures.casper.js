#!/bin/sh
//bin/true 2>/dev/null; exec casperjs --web-security=false --ignore-ssl-errors=true --verbose --log-level=info "$0" "$@"

var
config = {
    agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.94 Safari/537.36',
    timeout: 60000,
    minSize: 170000,
    windowWidth: 1920,
    windowHeight: 1080,
    minWidth: 192,
    minHeight: 192,
    minPixels: 192 * 192,
    maxScroll: 20,
},
casper = require('casper').create({
    pageSettings: {
	webSecurityEnabled: false
    },
    //clientScripts: ['./spark-md5.js']
    onPageInitialized: function (page) {
	page.evaluate(function (config) {
	    window.screen = {
		width: config.windowWidth,
		height: config.windowHeight,
	    };
	},
	config);
    }
}),
utils = require('utils'),
fs = require('fs'),
base64 = require('base64-js'),
md5 = require('js-md5'),
args = casper.cli.args.slice(0),
urls = {}; // object type, to prevent duplicate urls

//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////

// http://stackoverflow.com/a/1203361/496899
function filename_ext(fname) {
    return fname.substr((~-fname.lastIndexOf(".") >>> 0) + 2);
}

// create dummy html for images
function build_dummy_uri(image_list) {
    var html = '<body>';
    for (var i in image_list) {
	var image = image_list[i];
	html = html + '<img src="' + image + '"></img>';
    }
    return 'data:text/html, ' + encodeURI(html)
}

// format number
function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

var last_file_number = 1;

function make_filename(mimeType) {
    var ext, filename;
    ext = mimeType.split(/\//).pop().toLowerCase();
    if ( 0 == mimeType.indexOf('image/jpeg') ) {
	ext = 'jpg';
    }
    do {
	last_file_number += 1;
	filename = pad(last_file_number,8) + '.' + ext;
    } while ( fs.exists(filename) );
    return filename;
}

//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

var re_image = /.*\.(jpg|jpeg|png|tiff)$/;
var re_youtube = /(www\.)?youtube\.com\/watch\?v=(.+)/;

for (i in args) {

    var url = args[i], found;

    if (url.match(re_image)) {
	casper.echo('### is_image: ' + url);
	casper_target_resources[url] = 'image/' + filename_ext(url);
	url = build_dummy_uri([url]);
	urls[url] = url;
	continue
    }

    if (found = url.match(re_youtube)) {
	casper.echo('### is_youtube: ' + url);
	// NOTE: img.youtube.com urls: 0.jpg 1.jpg 2.jpg 3.jpg default.jpg hqdefault.jpg mqdefault.jpg sddefault.jpg maxresdefault.jpg
	var image1 = 'http://img.youtube.com/vi/' + found[2] + '/hqdefault.jpg',
	    image2 = 'http://img.youtube.com/vi/' + found[2] + '/maxresdefault.jpg';
	casper_target_resources[image1] = 'image/jpeg';
	casper_target_resources[image2] = 'image/jpeg';
	url = build_dummy_uri([image1, image2]);
	urls[url] = url;
	continue
    }

    casper.echo('### url: ' + url);

    urls[url] = url;

}

//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

var casper_target_resources = {}; // object type, to prevent duplicate urls

casper.options.waitTimeout = config.timeout;
casper.userAgent(config.agent);

var messages = [
    'page.error',
    'complete.error',
    'step.error',
    'load.failed',
    // 'downloaded.file',
    // 'load.started',
    // 'load.finished',
];

for (var i in messages) {
    (function (message) {
	casper.echo('### added handler for event: ' + message);
	casper.on(message, function () {
	    this.echo('### ' + message, 'ERROR');
	    this.echo(JSON.stringify(arguments, null, '  '));
	});
    })(messages[i]);
}

casper.on('remote.message', function (message) {
    this.echo('[console.log] ' + message, 'INFO')
});

casper.on('resource.received', function (resource) {
    var prefix, data, s, md5sum,
	url = resource.url,
	contentType = resource.contentType,
	bodySize = resource.bodySize;
    /// collect url into casper_target_resources, if contentType bodySize matches
    if (/^image\//.test(contentType)) {
	//if (typeof bodySize == 'undefined' || bodySize > config.minSize) {
	casper_target_resources[url] = contentType;
	//}
    }
});

casper.on('resource.error', function (resourceError) {
    this.echo('[resource.error] ' + resourceError.errorCode + ', ' + errorString, 'ERROR');
    this.echo('url=' + resourceError.url, 'ERROR');
})

casper.on('error', function (msg, backtrace) {
    this.echo('[error] ' + msg, 'ERROR');
    this.echo(JSON.stringify(backtrace, null, '  '));
});

//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////

function download_resource(src, mimeType) {
    var filename = make_filename(mimeType);
    casper.echo('download_resource: ' + mimeType + ' ' + filename, 'INFO');
    try {
	casper.download(src, filename);
    } catch (e) {
	casper.echo('### download_resource failed: ' + e, 'ERROR');
    }
}

function handle_page() {
    var
    i,
    next_y,
    cx = config.windowWidth / 2 | 0,
    cy_incr = config.windowHeight * 8 / 10 | 0;

    function collect_resources(resources, config) {
	function check_image_size(img, config) {
	    if (config.minHeight && img.height && img.height < config.minHeight) return false;
	    if (config.minWidth && img.width && img.width < config.minWidth) return false;
	    if (config.minPixels && img.width && img.height && img.width * img.height < config.minPixels) return false;
	    return true;
	}
	if (typeof window.collected_resources === 'undefined') window.collected_resources = {};
	for (url in resources) {
	    (function (url, mimeType) {
		var img = new Image();
		img.onLoad = function () {
		    if (check_image_size(img, config)) {
			window.collected_resources[url] = {
			    mimeType: mimeType,
			    url: url
			};
		    }
		}
		img.src = url;
		if (img.complete || img.readyState === 4) {
		    img.onLoad();
		}
	    })(url, resources[url]);
	}
	console.log('=== scroll ===: found ' + Object.keys(window.collected_resources).length);
	return window.collected_resources;
    }

    next_y = 0;

    this.wait(7500, function () { this.evaluate(collect_resources,casper_target_resources,config); });

    for (i = 0; i < config.maxScroll; i++) {
	this.then(function () { next_y += cy_incr; this.echo('===== scrollTo: '+cx+','+next_y); this.scrollTo(cx, next_y); })
	this.wait(5000, function () { this.evaluate(collect_resources,casper_target_resources,config); });
    }

    this.then(function(){
	var resources = this.evaluate(function(){
		return window.collected_resources;
	    }),
	    urls = Object.keys(resources),
	    i;
	for (i = 0; i < urls.length; i++) {
	    download_resource(
		urls[i],
		resources[urls[i]].mimeType);
	}
    });
}

casper.start().eachThen(Object.keys(urls), function (response) {
    if (!response.data) {
	this.echo('### skip empty url');
	return;
    }
    this.thenOpen(response.data);
    this.then(handle_page.bind(this));
});

casper.run()

// Emacs:
// mode: javascript
// c-basic-offset: 4
// tab-width: 4
// indent-tabs-mode: nil
// End:
// vim: se ft=javascript st=4 ts=8 sts=4 :
