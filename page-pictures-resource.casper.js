#!/usr/bin/env casperjs
var casper = require('casper').create({
    //verbose: true,
    logLevel: "debug",
    pageSettings: { webSecurityEnabled: false }
});
var dump = require('utils').dump;


function dump_indices(obj,tag) {
    if ( obj ) {
	var indices = [];
	for ( var i in obj ) {
	    indices.push(i);
	}
	casper.echo('=== dump_indices ===: '+tag);
	dump(indices);
    }
}


var agent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.94 Safari/537.36';
var timeout = 5000; /* 5s ? */
var minSize = 170000; /* 170k ? */

var urls = casper.cli.args.slice(0);
var images = [];

var hashcode = require('./hashcode.js');

//casper.options.waitTimeout = timeout;
casper.userAgent(agent);

casper.on('remote.message',function(message){ this.echo('message: '+message) });

casper.on('error',function(msg,backtrace){ this.echo('error: '+msg); dump(backtrace[0]) });
casper.on('page.error',function(msg,backtrace){ this.echo('page.error:'+msg); dump(backtrace[0]) });
casper.on('complete.error',function(err){ this.echo('complete.error: '+err) });

casper.on('resource.received',function(resource){
    //dump_indices(resource,'resource.received');

    var url = resource.url,
    contentType = resource.contentType,
    bodySize = resource.bodySize ;

    if ( /^image\//.test(contentType) &&
	 resource.bodySize &&
	 resource.bodySize > minSize ) {

	if ( url.length > 500 ) {
	    url = url.substr(0,500)+'...';
	}

	this.echo('resource.recevied: '+contentType+' '+bodySize+' '+url);

    }

});

casper.start().eachThen(urls,function(response){
    this.thenOpen(response.data,function(response){
	var url = response.url,
	collect_images_bound = function(url) {
	    this.echo('collect: '+hashcode.hashCodeHex(url)+' '+url);
	    var new_images = this.evaluate(function(){
		/* BEGIN client */

		var imgs = document.querySelectorAll('img'),
		srcs = [];
		console.log('### client ### collect: '+imgs.length);

		// NOTE: imgs is 'nodeList', not 'array'
		for ( var i = 0; i < imgs.length; i++ ) {

		    /* get natural (unscaled) size of the image */

		    var img = new Image(),width,height,mimeType,src;

		    img.onLoad = function(){
			var info = {
			    width: img.width,
			    height: img.height,
			    mimeType: img.mimeType,
			    src: img.src
			};

			console.log('### client ### imgs-'+i+': '+info.width+'x'+info.height+' '+info.mimeType+' '+info.src);

			if ( info.width > 450 && info.height > 450 && info.width * info.height > 288000 ) {
			    srcs.push(info);
			}

		    };
		    img.src = imgs[i].src;
		    if(img.complete || img.readyState === 4) img.onLoad();

		}
		return srcs
		/* END client */
	    });
	    images = images.concat(new_images)
	}.bind(this)	;

	this.then(function(){

	    var url = this.getCurrentUrl(),
	    frames = this.getElementsInfo('iframe'),
	    num_frames = frames.length,
	    frame_indices = [] ;


	    //dump(frames);


	    for ( var i = 0; i < num_frames; i++ ) {
		var frame = frames[i];
		//dump_indices(frame,'frame');
		if ( frame.attributes.src && frame.attributes.src.length > 0 ) {
		    frame_indices.push(i);
		}
	    }

	    this.echo('found frames: '+frame_indices.length+'/'+num_frames);

	    this.wait(timeout);

	    collect_images_bound(url);

	    if ( frame_indices.length > 0 ) {
		for ( var i = 0; i < frame_indices.length; i++ ) {
		    this.withFrame(frame_indices[i],function(response){
			var url = response.url;
			this.echo('=== withFrame ===: '+url);
			collect_images_bound(url);
		    })
		}
	    }

	});
    })
});

casper.then(function(){
    //dump(images)
    for ( var i = 0; i < images.length; i++ ) {
	var info = images[i],
	src = info.src,
	basename = src.split(/[?#]/).shift().split(/[\/]/).pop(), /* basename() */
	filename = ''+basename+'_'+hashcode.hashCodeHex(src)+'.png';
	this.echo('download: '+src+' '+filename);
	try{
	    this.download(src,filename);
	}catch(e){
	    /* */
	}
    }
});

casper.run()
