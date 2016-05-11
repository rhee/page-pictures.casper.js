!!function(){
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
    //export as casperjs module
    exports.hashCode = hashCode;
    exports.hashCodeHex = hashCodeHex;
}()
