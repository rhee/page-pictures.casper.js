#!/bin/sh
//bin/true; exec casperjs --engine=phantomjs --web-security=false --ignore-ssl-errors=true --verbose --log-level=info "$0" "$@"
//bin/true; exec casperjs --web-security=false --ignore-ssl-errors=true --verbose --log-level=info "$0" "$@"
//bin/true; exec casperjs --web-security=false --ignore-ssl-errors=true --verbose --log-level=info --proxy=127.0.0.1:9050 --proxy-type=socks5 "$0" "$@"
(function() {

    var casper = require('casper').create({
        //verbose: true,
        //logLevel: "info",
        pageSettings: {
            webSecurityEnabled: false
        },
        //clientScripts: ['./spark-md5.js']
    });

    var args = casper.cli.args.slice(0),
        urls = {}; // object type, to prevent duplicate urls

    var utils = require('utils');

    var config = {
        agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.94 Safari/537.36',
        timeout: 60000,
        /* 30s //5s ? */
        minSize: 170000,
        /* 170k ? */
        minWidth: 1080,
        minHeight: 1080,
        minPixels: 1920 * 1080,
    }

    // http://stackoverflow.com/a/1203361/496899
    function sans_ext(fname) {
        //return fname.lastIndexOf('.') > 0 ?
    	//  fname.substr(0,filename.lastIndexOf('.')+1) :
    	//  fname;
	return fname.substr((~-fname.lastIndexOf(".") >>> 0) + 2);
    }

    function basename_sans_ext(path) {
        var nodirname = path.split(/[?#]/).shift().split(/[\/]/).pop(), /* basename() */
	    basename = sans_ext(nodirname);
        return basename;
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
    //////////////////////////////////////////////////////////////////////////////

    function casper_dump_shallow(object, title) {

        casper.echo(title + ':');
        for (var k in object) {
            casper.echo('    ' + k + ': ' + JSON.stringify(object[k]));
        }

    }

    function casper_download_resource(src, mimeType, outdir) {

	var outdir_ = outdir ? outdir.endsWith('/') ? outdir : outdir + '/' : './',
	    base = basename_sans_ext(src),
            ext = mimeType.split(/\//).pop().toLowerCase(),
            filename = outdir_ + (base + '-' + hash_string(src)) + '.' + ext;
        casper.echo('casper_download_resource: ' + abbrev_url(src) + ' ' + filename);
        try {
            casper.download(src, filename);
        } catch (e) {
            /* */
        }

    }

    //////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////

    var casper_target_resources = {}; // object type, to prevent duplicate urls

    casper.options.waitTimeout = config.timeout;
    casper.userAgent(config.agent);

    casper.on('remote.message', function(message) {
        this.echo('### remote.message: ' + message)
    });

    casper.on('error', function(msg, backtrace) {
        casper_dump_shallow(backgrace, '### ' + msg)
    });
    casper.on('page.error', function(msg, backtrace) {
        casper_dump_shallow(backtrace, '### ' + msg)
    });
    casper.on('complete.error', function(err) {
        this.echo('### complete.error: ' + JSON.stringify(err))
    });
    casper.on('resource.error', function(resourceError) {
        casper_dump_shallow(resourceError, '### resource.error: ' + resourceError.errorString)
    });
    casper.on('step.error', function(err) {
	this.echo('### step.error: '+err.sourceURL+':'+err.line)
	this.echo('----------------------')
	this.echo(err.stack)
	this.echo('----------------------')
    });

    casper.on('resource.received', function(resource) {
        /// collect url into casper_target_resources, if contentType bodySize matches
        if (/^image\//.test(resource.contentType)) {
            //this.echo('recource.received.image: ' + abbrev_url(resource.url, 69));
            if (typeof resource.bodySize == 'undefined' || resource.bodySize > config.minSize) {
                casper_target_resources[resource.url] = resource.url;
            }
        }
    });

    var re_image = /.*\.(jpg\|jpeg\|png\|tiff)/;
    var re_youtube = /(www\.)?youtube\.com\/watch\?v=(.+)/;

    for (i in args) {

        var url = args[i],
            is_youtube = url.match(re_youtube),
            is_image = url.match(re_image);

        if (is_image) {
            casper.echo('### is_image: ' + url);
            casper_target_resources[url] = url;
        }

        if (is_youtube) {
            casper.echo('### is_youtube: ' + url);
            // NOTE: img.youtube.com urls: 0.jpg 1.jpg 2.jpg 3.jpg default.jpg hqdefault.jpg mqdefault.jpg sddefault.jpg maxresdefault.jpg
            var image1 = 'http://img.youtube.com/vi/' + found[2] + '/hqdefault.jpg',
                image2 = 'http://img.youtube.com/vi/' + found[2] + '/maxresdefault.jpg';
            casper_target_resources[image1] = image1
            casper_target_resources[image2] = image2
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
                            ! function(url, mimeType) {
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
                            }(url, resources[url]);
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

})();

// Emacs:
// mode: javascript
// c-basic-offset: 4
// tab-width: 4
// indent-tabs-mode: nil
// End:
// vim: se ft=javascript st=4 ts=8 sts=4
