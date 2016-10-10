#!/bin/sh
 //bin/true 2>/dev/null; exec casperjs              --web-security=false --ignore-ssl-errors=true --verbose --log-level=info "$0" "$@"
//bin/true 2>/dev/null; exec casperjs --debug=true --web-security=false --ignore-ssl-errors=true --verbose --log-level=info "$0" "$@"

var
    config = {
        agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.94 Safari/537.36',
        timeout: 60000,
        minSize: 75000,
        windowWidth: 1920,
        windowHeight: 1080,
        minWidth: 1080,
        minHeight: 1080,
        minPixels: 1920 * 1080,
        maxScroll: 0,
    },
    casper = require('casper').create({
        verbose: true,
        logLevel: "info",
        pageSettings: {
            webSecurityEnabled: false
        },
    }),
    utils = require('utils'),
    fs = require('fs'),
    args_urls = {},
    casper_received_urls = {};

var re_image = /.*\.(jpg|jpeg|png|tiff)$/;
var re_youtube = /(www\.)?youtube\.com\/watch\?v=(.+)/;

var url_passed = {};

//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////

casper.options.waitTimeout = config.timeout;
casper.userAgent(config.agent);

var messages = [
    'page.error',
    'complete.error',
    'step.error',
    'load.failed'
    // 'downloaded.file',
    // 'load.started',
    // 'load.finished',
];

for (var i = 0; i < messages.length; i++) {
    var message = messages[i];
    casper.echo('### added handler for event: ' + message);
    casper.on(message, function() {
        this.echo('### ' + message, 'ERROR');
        this.echo(JSON.stringify(arguments, null, '  '));
    });
}

casper.on('remote.message', function(message) {
    this.echo(message, 'INFO');
});

casper.on('page.initialized', function(page) {
    page.evaluate(
        function(config, page) {
            window.screen = {
                width: config.windowWidth,
                height: config.windowHeight
            };
            console.info([
                ['page.initialized'], config.windowWidth, config.windowHeight, page.url
            ]);
        },
        config,
        page);
});

casper.on('resource.received', function(resource) {
    var url = resource.url,
        contentType = resource.contentType,
        bodySize = resource.bodySize;
    /// collect url into casper_target_resources, if contentType bodySize matches
    if (/^image\//.test(contentType)) {
        if (typeof bodySize == 'undefined' || bodySize > config.minSize) {
            casper_received_urls[url] = resource;
        }
    }
});

casper.on('resource.error', function(resourceError) {
    this.echo('[resource.error] ' + resourceError.errorCode + ', ' + errorString, 'ERROR');
    this.echo('url=' + resourceError.url, 'ERROR');
});

casper.on('error', function(msg, backtrace) {
    this.echo('[error] ' + msg, 'ERROR');
    this.echo(JSON.stringify(backtrace, null, '  '));
});

//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////

var last_file_number = 1;

function download_resource(src, mimeType) {
    var filename = make_filename(mimeType);
    casper.echo('download_resource: ' + mimeType + ' ' + filename, 'INFO');
    try {
        casper.download(src, filename);
    } catch (e) {
        casper.echo('### download_resource failed: ' + e, 'ERROR');
    }

    function make_filename(mimeType) {
        var ext, filename;
        ext = mimeType.split(/\//).pop().toLowerCase();
        if (0 === mimeType.indexOf('image/jpeg')) {
            ext = 'jpg';
        }
        do {
            last_file_number += 1;
            filename = pad(last_file_number, 8) + '.' + ext;
        } while (fs.exists(filename));
        return filename;

    }

    // format number
    function pad(n, width, z) {
        z = z || '0';
        n = n + '';
        return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    }

}

function handle_page(casper, url) {
    var
        i,
        next_y,
        cx = config.windowWidth / 2 | 0,
        cy_incr = config.windowHeight * 8 / 10 | 0;

    next_y = 0;

    casper.thenOpen(url);
    casper.wait(7500);
    casper.then(function() {
        this.evaluate(collect_resources, casper_received_urls, config);
    });

    for (i = 0; i < config.maxScroll; i++) {
        casper.then(function() {
            next_y += cy_incr;
            this.echo('===== scrollTo: ' + cx + ',' + next_y);
            this.scrollTo(cx, next_y);
        });
        casper.wait(5000);
        casper.then(function() {
            this.evaluate(collect_resources, casper_received_urls, config);
        });
    }

    casper.then(function() {
        var resources = this.evaluate(function() {
                return window.collected_resources;
            }),
            urls = Object.keys(resources);
        for (var i = 0; i < urls.length; i++) {
            download_resource(
                urls[i],
                resources[urls[i]].mimeType);
        }
    });

    return;

    function collect_resources(resources, config) {
        if (typeof window.collected_resources === 'undefined') window.collected_resources = {};
        var list = Object.keys(resources);
        for (var i = 0; i < list.length; i++) {
            var url = list[i],
                mimeType = resources[url].contentType,
                img = new Image();
            img.onLoad = function() {
                if (check_image_size(img, config)) {
                    window.collected_resources[url] = {
                        mimeType: mimeType,
                        url: url
                    };
                }
            };
            img.src = url;
            if (img.complete || img.readyState === 4) {
                img.onLoad();
            }
        }
        console.log('=== scroll ===: found ' + Object.keys(window.collected_resources).length);
        return window.collected_resources;

        function check_image_size(img, config) {
            if (config.minHeight && img.height && img.height < config.minHeight) return false;
            if (config.minWidth && img.width && img.width < config.minWidth) return false;
            if (config.minPixels && img.width && img.height && img.width * img.height < config.minPixels) return false;
            return true;
        }
    }

}

//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

var args = casper.cli.args.slice(0);

for (var i = 0; i < args.length; i++) {
    var url = args[i],
        found;

    if (url.match(re_image)) {
        casper.echo('### is_image: ' + url);

        new_url = build_dummy_uri([url]);
        args_urls[new_url] = new_url;

        continue;
    }

    if ((found = url.match(re_youtube))) {
        casper.echo('### is_youtube: ' + url);
        // NOTE: img.youtube.com urls: 0.jpg 1.jpg 2.jpg 3.jpg default.jpg hqdefault.jpg mqdefault.jpg sddefault.jpg maxresdefault.jpg

        new_url = build_dummy_url(['http://img.youtube.com/vi/' + found[2] + '/hqdefault.jpg']);
        args_urls[new_url] = new_url;

        new_url = build_dummy_url(['http://img.youtube.com/vi/' + found[2] + '/maxresdefault.jpg']);
        args_urls[new_url] = new_url;

        continue;
    }

    casper.echo('### url: ' + url);

    args_urls[url] = url;

}

casper.start().eachThen(Object.keys(args_urls), function(response) {
    if (!response.data) {
        this.echo('### skip empty url');
        return;
    }
    handle_page(this, response.data);
});

casper.run();

// Emacs:
// mode: javascript
// c-basic-offset: 4
// tab-width: 4
// indent-tabs-mode: nil
// End:
// vim: se ft=javascript st=4 ts=8 sts=4 :