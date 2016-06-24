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

    var arg_urls = casper.cli.args.slice(0),
        urls = [];

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

    function casper_basename(path) {
        var basename = path.split(/[?#]/).shift().split(/[\/]/).pop(); /* basename() */
        return basename;
    }

    function casper_abbrev_url(url, limit) {
        limit = limit || 100;
        return (url.length > limit) ? '[... ' + casper_basename(url) + ']' : url;
    }

    function casper_dump_shallow(object, title) {
        casper.echo(title + ':');
        for (var k in object) {
            casper.echo('    ' + k + ': ' + JSON.stringify(object[k]));
        }
    }

    function casper_dump_backtrace(msg, backtrace) {
        casper_dump_shallow(backtrace, msg);
    }

    function casper_hash_string(str) {
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

    function casper_download_image(src, mimeType, hash, outdir) {

        var basename = casper_basename(src),
            ext = mimeType.split(/\//).pop().toLowerCase(),
            filename = (outdir ? outdir : '') + (hash ? hash : basename + '_' + casper_hash_string(src)) + '.' + ext;
        casper.echo('casper_download_image: ' + casper_abbrev_url(src) + ' ' + filename);
        try {
            casper.download(src, filename);
        } catch (e) {
            /* */
        }

    }

    //////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////

    var casper_image_resources = {};

    casper.options.waitTimeout = config.timeout;
    casper.userAgent(config.agent);

    casper.on('remote.message', function(message) {
        this.echo('message: ' + message)
    });

    casper.on('error', function(msg, backtrace) {
        casper_dump_backtrace(msg, backtrace)
    });
    casper.on('page.error', function(msg, backtrace) {
        casper_dump_backtrace(msg, backtrace)
    });
    casper.on('complete.error', function(err) {
        this.echo('complete.error: ' + JSON.stringify(err))
    });
    casper.on('resource.error', function(resourceError) {
        this.echo('resource.error: ' + resourceError.errorString + ' ' + casper_abbrev_url(resourceError.url, 50))
    }); //{ casper_dump_shallow(resourceError,'resource.error'); });
    casper.on('step.error', function(err) {
        this.echo('step.error: ' + JSON.stringify(err));
    });

    casper.on('resource.received', function(resource) {
        /// collect url into casper_image_resources, if contentType bodySize matches
        if (/^image\//.test(resource.contentType)) {
            //this.echo('recource.received.image: ' + casper_abbrev_url(resource.url, 69));
            if (typeof resource.bodySize == 'undefined' || resource.bodySize > config.minSize) {
                casper_image_resources[resource.url] = resource.contentType;
            }
        }
    });



    var re_image = /.*\.(jpg\|jpeg\|png\|tiff)/;

    //https://www.youtube.com/watch?v=ZIivpO9TnII
    //http://img.youtube.com/vi/<insert-youtube-video-id-here>/0.jpg
    //var re_youtube = /https?::\/\/(www\.)?youtube.com\/watch\?v=(.+)/;
    var re_youtube = /(www\.)?youtube\.com\/watch\?v=(.+)/;

    for (i in arg_urls) {

        var url = arg_urls[i],
            is_youtube = url.match(re_youtube),
            is_image = url.match(re_image);

        if (is_image) {
            casper.echo('is_image: ' + url);
            casper_image_resources.push(url);
        }

        if (is_youtube) {
            casper.echo('is_youtube: ' + url);
            // NOTE: img.youtube.com urls: 0.jpg 1.jpg 2.jpg 3.jpg default.jpg hqdefault.jpg mqdefault.jpg sddefault.jpg maxresdefault.jpg
            var image1 = 'http://img.youtube.com/vi/' + found[2] + '/hqdefault.jpg',
                image2 = 'http://img.youtube.com/vi/' + found[2] + '/maxresdefault.jpg';
            casper_image_resources.push(image1)
            casper_image_resources.push(image2)
        }

        urls.push(url);

    }



    casper.start().eachThen(urls, function(response) {

        if (!response.data) {
            this.echo('=== skip empty url===');
        } else {
            this.thenOpen(response.data);
            this.then(function() {
                this.evaluate(function(resources, config) {
                    if (typeof window.collected_images === 'undefined') {
                        window.collected_images = {};
                    }
                    for (url in resources) {
                        ! function(url, mimeType) {
                            var img = new Image();
                            img.onLoad = function() {
                                var hash;
                                if (img.width >= config.minWidth &&
                                    img.height >= config.minHeight &&
                                    img.width * img.height >= config.minPixels) {
                                    window.collected_images[url] = {
                                        mimeType: mimeType,
                                        hash: hash
                                    };
                                }
                            }
                            img.src = url;
                            if (img.complete || img.readyState === 4) {
                                img.onLoad();
                            }
                        }(url, resources[url]);
                    }
                }, casper_image_resources, config);
            });
            this.then(function() {
                var images = this.evaluate(function() {
                    return window.collected_images
                });
                casper_dump_shallow(images, '=== end of scan ===: found ' + images.length);
                for (url in images) {
                    var info = images[url];
                    casper_download_image(url, info.mimeType, info.hash, './');
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