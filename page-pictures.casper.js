#!/bin/sh
//bin/true; exec casperjs --engine=phantomjs --web-security=false --ignore-ssl-errors=true --verbose --log-level=info "$0" "$@"
//bin/true; exec casperjs --web-security=false --ignore-ssl-errors=true --verbose --log-level=info "$0" "$@"
//bin/true; exec casperjs --web-security=false --ignore-ssl-errors=true --verbose --log-level=info --proxy=127.0.0.1:9050 --proxy-type=socks5 "$0" "$@"

var
casper = require('casper').create({
    pageSettings: {
	webSecurityEnabled: false
    },
    //clientScripts: ['./spark-md5.js']
}),
utils = require('utils');

var
config = {
    agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.94 Safari/537.36',
    timeout: 60000,
    /* 30s //5s ? */
    minSize: 170000,
    /* 170k ? */
    minWidth: 1080,
    minHeight: 1080,
    minPixels: 1920 * 1080
},
args = casper.cli.args.slice(0),
urls = {}; // object type, to prevent duplicate urls

// Polyfill String.prototype.endsWith
// see: https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
if (!String.prototype.endsWith) {
  String.prototype.endsWith = function(searchString, position) {
      var subjectString = this.toString();
      if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
        position = subjectString.length;
      }
      position -= searchString.length;
      var lastIndex = subjectString.indexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
  };
}

// http://stackoverflow.com/a/1203361/496899
function filename_ext(fname) {
    return fname.substr((~-fname.lastIndexOf(".") >>> 0) + 2);
}

// http://stackoverflow.com/a/1203361/496899
function filename_sans_ext(fname) {
    return fname.substr(0,(~-fname.lastIndexOf(".") >>> 0) + 2 - 1);
}

function uri_basename(path) {
    return path.split(/[?#]/).shift().split(/[\/]/).pop();
}

function abbrev_url(url, limit) {
    limit = limit || 100;
    return (url.length > limit) ? '[... ' + basename(url) + ']' : url;
}

function hash_string(str) {
    var hashCode = function(str) {
	var hash = 0;
	if (str.length == 0) return hash;
	for (i = 0; i < str.length; i++) {
	    char = str.charCodeAt(i);
	    hash = ((hash << 5) - hash) + char;
	    hash = hash & hash; // Convert to 32bit integer
	}
	return hash;
    },
    num = hashCode(str);
    return (num < 0 ? (0xFFFFFFFF + num + 1) : num).toString(16);
}

//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////

function casper_download_resource(src, mimeType, outdir) {

    var
    outdir_ = outdir ? outdir.endsWith('/') ? outdir : outdir + '/' : './',
    basename = uri_basename(src),
    sans_ext = filename_sans_ext(basename),
    new_ext = mimeType.split(/\//).pop().toLowerCase(),
    hash = hash_string(src),
    filename = outdir_ + (sans_ext + '--' + hash) + '.' + new_ext;

    casper.echo('casper_download_resource: ' + abbrev_url(src) + ', ' + mimeType + ', ' + outdir, 'INFO');

    try {
	casper.download(src, filename);
    } catch (e) {
	casper.echo('### casper.download failed: '+e, 'ERROR');
    }

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

for ( var i in messages ) {
    (function(message){
	casper.echo('### added handler for event: '+message);
	casper.on(message, function() {
	    this.echo('### ' + message, 'ERROR');
	    this.echo(JSON.stringify(arguments, null, '  '));
	});
    })(messages[i]);
}

casper.on('remote.message', function(message) {
  this.echo('[console.log] ' + message)
});

casper.on('resource.received', function(resource) {
    /// collect url into casper_target_resources, if contentType bodySize matches
    if (/^image\//.test(resource.contentType)) {
	//this.echo('recource.received.image: ' + abbrev_url(resource.url, 69));
	if (typeof resource.bodySize == 'undefined' || resource.bodySize > config.minSize) {
	    casper_target_resources[resource.url] = resource.contentType;
	}
    }
});

### resource.error
{
  "0": {
    "errorCode": 5,
    "errorString": "Operation canceled",
    "id": 932,
    "status": null,
    "statusText": null,
    "url": "http://darkmarin.com/plugin/kcaptcha/kcaptcha_image.php?t=1468313952021"
  }
}

casper.on('resource.error', function(resourceError) {
    this.echo('[resource.error] ' + resourceError.errorCode + ', ' + errorString, 'ERROR');
    this.echo('url=' + resourceError.url, 'ERROR');
})

casper.on('error', function(msg,backtrace) {
    this.echo('[error] '+msg, 'ERROR');
    this.echo(JSON.stringify(backtrace, null, '  '));
});

var re_image = /.*\.(jpg\|jpeg\|png\|tiff)/;
var re_youtube = /(www\.)?youtube\.com\/watch\?v=(.+)/;

for (i in args) {

    var url = args[i],
    is_youtube = url.match(re_youtube),
    is_image = url.match(re_image);

    if (is_image) {
	casper.echo('### is_image: ' + url);
	casper_target_resources[url] = filename_ext(url);
    }

    if (is_youtube) {
	casper.echo('### is_youtube: ' + url);
	// NOTE: img.youtube.com urls: 0.jpg 1.jpg 2.jpg 3.jpg default.jpg hqdefault.jpg mqdefault.jpg sddefault.jpg maxresdefault.jpg
	var image1 = 'http://img.youtube.com/vi/' + found[2] + '/hqdefault.jpg',
	image2 = 'http://img.youtube.com/vi/' + found[2] + '/maxresdefault.jpg';
	casper_target_resources[image1] = 'image/jpeg';
	casper_target_resources[image2] = 'image/jpeg';
    }

    urls[url] = url;

}



casper.start().eachThen(Object.keys(urls), function(response) {

    if (!response.data) {
	this.echo('### skip empty url');
    } else {
	this.thenOpen(response.data);
	this.then(function() {
	    this.evaluate(
		function(resources, config) {
		    if (typeof window.collected_resources === 'undefined') {
			window.collected_resources = {};
		    }
		    for (url in resources) {
			(function(url, mimeType) {
			    var img = new Image();
			    img.onLoad = function() {
				if (img.width >= config.minWidth &&
				    img.height >= config.minHeight &&
				    img.width * img.height >= config.minPixels) {
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
		    console.log('=== end of page ===: found ' + Object.keys(window.collected_resources).length);
		},
		casper_target_resources,
		config);
	    while (true) {
		var info = this.evaluate(
		    function() {
			if (window.collected_resources) {
			    var url = Object.keys(window.collected_resources).shift(),
			    info = window.collected_resources[url];
			    delete window.collected_resources[url];
			    return info
			}
			return nil
		    }
		);
		if (!info) {
		    break;
		}
		casper_download_resource(info.url, info.mimeType, './')
	    }
        });
    }

});

casper.run()

// Emacs:
// mode: javascript
// c-basic-offset: 4
// tab-width: 4
// indent-tabs-mode: nil
// End:
// vim: se ft=javascript st=4 ts=8 sts=4
