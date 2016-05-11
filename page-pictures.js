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



String.prototype.hashCode = function(){
	var hash = 0;
	if (this.length == 0) return hash;
	for (i = 0; i < this.length; i++) {
		char = this.charCodeAt(i);
		hash = ((hash<<5)-hash)+char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return hash;
}


//casper.options.waitTimeout = 60000;
casper.userAgent(agent);

casper.on('remote.message',function(message){ this.echo(message) });
casper.on('error',function(msg,backtrace){ dump(['error:',msg]) });
casper.on('complete.error',function(err){ dump(['error:',err]) });
casper.on('page.error',function(msg,trace){ dump(['error:',msg]) });

casper.start().eachThen(urls,function(response){
    this.thenOpen(response.data,function(response){
	var url = response.url,
	    /* NOTICE: use bind(this) to call */
	    collect_bound = function() {
		var new_images = this.evaluate(function(){
		    /* BEGIN client */
		    var imgs = document.querySelectorAll('img');
		    console.log('### client ###: count=',imgs.length);
		    var srcs = [];
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
			console.log('### client ###: ',info);
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
	    console.log('### client ###: onload installed');
	    /* END client */
	});
	this.waitForAlert(function(response){
	    this.echo('Alert received: '+response.data);
	},function(){
	    this.echo('No alert received within '+timeout);
	},timeout);
	this.then(function(){
	    var num_frames = this.getElementsInfo('iframe').length;
	    for ( var i = 0; i < num_frames; i++ ) {
		this.withFrame(i,function(){
		    var url = this.getCurrentUrl(); //response.url;
		    if ( 'about:blank' != url ) {
			var hash = url.hashCode();
			this.echo('Fetch: '+hash+' '+url);
			this.waitForAlert(function(response){
			    this.echo('Alert received: '+response.data);
			    collect_bound();
			},function(){
			    this.echo('No alert received');
			    collect_bound();
			},timeout);
		    }
		})
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
	this.download(src,filename);
    }
});

casper.run()
