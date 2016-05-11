#!/usr/bin/env casperjs
;
var casper = require('casper').create({
    //verbose: true,
    logLevel: "debug",
    pageSettings: {
        webSecurityEnabled: false
    }
});

//require('utils').dump(casper.cli.args);

var urls = casper.cli.args.slice(0);
var dump = require('utils').dump;
var images = [];
//var agent = 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)';
var agent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.94 Safari/537.36';
var timeout = 5000; /* 5s ? */


// define String.prototype.hashCode()
require('./hash.js');


//casper.options.waitTimeout = 60000;
casper.userAgent(agent);

casper.on('remote.message',function(message){ this.echo('message: '+message) });

casper.on('error',function(msg,backtrace){ this.echo('error: '+msg); dump(backtrace) });
casper.on('page.error',function(msg,backtrace){ this.echo('page.error:'+msg); dump(backtrace) });
casper.on('complete.error',function(err){ this.echo('complete.error: '+err) });

casper.on('resource.received',function(resource){
    //dump(resource);
    this.echo('resource.recevied: '+resource.contentType+' '+resource.url);
    if ( resource.contentType.startsWith('image/') &&
         resource.bodySize &&
         resource.bodySize > 100000 /* 100kB */ ) {
	this.echo('resource.received: '+resource.url);
    }
});

casper.start().eachThen(urls,function(response){
    this.thenOpen(response.data,function(response){
	var url = response.url,
	/* NOTICE: use bind(this) to call */
	collect_bound = function(url) {
	    this.echo('collect: '+url.hashCode()+' '+url);
	    var new_images = this.evaluate(function(){
		/* BEGIN client */
		var imgs = document.querySelectorAll('img'),
		srcs = [];
		console.log('### client ### collect: '+JSON.stringify(imgs));
		// NOTE: imgs is 'nodeList', not 'array'
		for ( var i = 0; i < imgs.length; i++ ) {
		    var width = imgs[i].width,
		    height = imgs[i].height,
		    mimeType = imgs[i].mimeType,
		    src = imgs[i].src,
		    info = {
			width: width,
			height: height,
			mimeType: mimeType,
			src: src
		    };
		    console.log('### client ### info=',JSON.stringify(info));
		    if ( width > 640 && height > 640 ) {
			srcs.push(info);
		    }
		}
		return srcs
		/* END client */
	    });
	    images = images.concat(new_images)
	}.bind(this)	;

	this.evaluate(function(){
	    /* BEGIN client */
	    //document.addEventListener('load',function(e){ alert('loaded'); });
	    window.onload = function () { alert('loaded') }
	    console.log('### client ### onload installed');
	    /* END client */
	});

	this.waitForAlert(function(response){
	    this.echo('Alert received: '+response.data);
	},function(){
	    this.echo('No alert received within '+timeout);
	},timeout);

	this.then(function(){

	    var num_frames = this.getElementsInfo('iframe').length;

	    if ( num_frames > 0 ) {
		for ( var i = 0; i < num_frames; i++ ) {
		    this.withFrame(i,function(response){
			this.echo('withFrame: '+response.url);
			var url = response.url;
			if ( 'about:blank' != url ) {
			    collect_bound(url);
			}
		    })
		}
	    } else {

		var url = this.getCurrentUrl(); //response.url;
		collect_bound(url);

	    }

	});
    })
});

casper.then(function(){
    dump(images)
    for ( var i = 0; i < images.length; i++ ) {
	var info = images[i],
	src = info.src,
	basename = src.split(/[\/]/).pop(), /* basename() */
	hash = src.hashCode(),
	filename = ''+basename+'-'+hash+'.png';
	try {
	    this.download(src,filename);
	}catch(e){
	    /**/
	}
    }
});

casper.run()
