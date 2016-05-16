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


var config = {
    agent : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.94 Safari/537.36',
    timeout : 5000, /* 5s ? */
    minSize : 170000, /* 170k ? */
    minWidth : 450,
    minHeight : 450,
    minPixels : 288000,
}

var urls = casper.cli.args.slice(0);
var images = [];

//!!function(){

    var hashCode = function(str){
	var hash = 0;
	if (str.length == 0) return hash;
	for (i = 0; i < str.length; i++) {
	    char = str.charCodeAt(i);
	    hash = ((hash<<5)-hash)+char;
	    hash = hash & hash; // Convert to 32bit integer
	}
	return hash;
    };

    var hashCodeHex = function(str){
	var num = hashCode(str);
	return (num < 0 ? (0xFFFFFFFF + num + 1) : num).toString(16);
    };

    var onImageSize = function (src,callback) {
	/* get natural (unscaled) size of the image */

	var img = new Image(),width,height,mimeType,src;

	img.onLoad = function(){
	    var info = {
		width: img.width,
		height: img.height,
		mimeType: img.mimeType,
		src: img.src
	    };

	    callback && callback(info);

	    /// if ( info.width > config.minWidth &&
	    ///      info.height > config.minHeight &&
	    ///      info.width * info.height > config.minPixels ) {
	    ///     srcs.push(info);
	    /// }

	};
	img.src = src;
	if(img.complete || img.readyState === 4) img.onLoad();
    }

//    //export as casperjs module
//    exports.hashCode = hashCode;
//    exports.hashCodeHex = hashCodeHex;
//}()


function dump_backtrace(msg,backtrace){
    casper.echo('backtrace: '+msg);
    for ( var i = 0 ; i < backtrace.length ; i++ ) {
	var f = backtrace[i];
	casper.echo('    '+f.file+':'+f.line+': '+f.function);
    }
}

//casper.options.waitTimeout = config.timeout;
casper.userAgent(config.agent);

casper.on('remote.message',function(message){ this.echo('message: '+message) });

casper.on('error',function(msg,backtrace){ dump_backtrace('error: '+msg,backtrace) });//this.echo('error: '+msg); dump(backtrace[0]) });
casper.on('page.error',function(msg,backtrace){ dump_backtrace('page.error: '+msg,backtrace) });//this.echo('page.error:'+msg); dump(backtrace[0]) });
casper.on('complete.error',function(err){ this.echo('complete.error: '+err) });

casper.on('resource.received',function(resource){
    //dump_indices(resource,'resource.received');

    var url = resource.url;

    if ( /^image\//.test(resource.contentType) &&
	 resource.bodySize &&
	 resource.bodySize > config.minSize ) {

	onImageLoad(resource.url,function(info){

	    if ( info.width >= config.minWidth &&
		 info.height >= config.minHeight &&
		 info.width * info.height >= config.minPixels ) {

		if ( url.length > 500 ) {
		    url = url.substr(0,500)+'...';
		}

		this.echo('resource.recevied: '+resource.contentType+' '+resource.bodySize+' '+url);

	    }

	});

    }

});

casper.start().eachThen(urls,function(response){
    this.thenOpen(response.data,function(response){
	var url = response.url,
	collect_images_bound = function(url) {
	    this.echo('collect: '+hashCodeHex(url)+' '+url);
	    var new_images = this.evaluate(function(){
		/* BEGIN client */

var config = {
    agent : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.94 Safari/537.36',
    timeout : 5000, /* 5s ? */
    minSize : 170000, /* 170k ? */
    minWidth : 450,
    minHeight : 450,
    minPixels : 288000,
};

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

			//console.log('### client ### imgs-'+i+': '+info.width+'x'+info.height+' '+info.mimeType+' '+info.src);

			if ( info.width > config.minWidth &&
			     info.height > config.minHeight &&
			     info.width * info.height > config.minPixels ) {
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

	    var url = this.getCurrentUrl(),frames=[],frame_indices=[];

	    /*
	    backtrace: error: CasperError: Cannot get information from iframe: no elements found.
		phantomjs://platform/casper.js:1093: getElementsInfo
		phantomjs://code/page-pictures:135: 
	    */

	    try {
		frames = this.getElementsInfo('iframe') ;
	    }catch(e){
		/* */
	    }

	    //dump(frames);

	    for ( var i = 0; i < frames.length; i++ ) {
		var frame = frames[i];
		//dump_indices(frame,'frame');
		if ( frame.attributes.src && frame.attributes.src.length > 0 ) {
		    frame_indices.push(i);
		}
	    }

	    this.echo('found frames: '+frame_indices.length+'/'+frames.length);

	    this.wait(config.timeout);

	    collect_images_bound(url);

	    if ( frame_indices.length > 0 ) {
		for ( var i = 0; i < frame_indices.length; i++ ) {
		    this.withFrame(frame_indices[i],function(response){

			//this.echo('=== withFrame ===: '+response.url+' '+response.redirectURL);
			//dump_indices(response,'withFrame');

			collect_images_bound(response.url);

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
	filename = ''+basename+'_'+hashCodeHex(src)+'.png';
	this.echo('download: '+src+' '+filename);
	try{
	    this.download(src,filename);
	}catch(e){
	    /* */
	}
    }
});

casper.run()
// vim: se filetype=javascript
