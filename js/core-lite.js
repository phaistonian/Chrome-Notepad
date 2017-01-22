if(!Core) {
var Core = {
	empty 		: function(){},
	version		: '0.92b',
	author		: 'georgep@phaistosnetworks.gr',
	inspiration	: 'Mootools, Base2, Prototype',
	path		: 'http://sobpool.phaistosnetworks.gr/pathfinder/core/',
	isHuman		: false
};



// ================================================================================
// Class | Inspired by Base2
// ================================================================================
var Class = function(properties){
	var klass 			= function(){
		this.constructor = klass;

		// TODO: We need to figure out a way to rule out the !== null thingy
		// in order to properly pass null arguments[0]
		return (arguments[0] !== null && this.initialize && $typeOf(this.initialize) == 'function') ?
		this.initialize.apply(this, arguments) : this;

		// Constructor is an alias to initialize
		// ADDED: 25 May 09
		return (arguments[0] !== null && this.initialize && $typeOf(this.constructor) == 'function') ?
		this.constructor.apply(this, arguments) : this;

	};
	$extend(klass, this);	// Inherit all from Class (even extend)
	klass.prototype 		= properties || {} // Use properties as prototype

	// ADDED: 03.06.2009
	// This is an easy way to
	// if(klass.prototype.options) {
	//	klass.prototype.options = new Abstract(klass.prototype.options);
	// }

	klass.constructor 		= Class;
	klass.ID 			 	= { type : 'class' }

	return klass;
};

Class.prototype =  {
	implement: function(){
		var obj = {}, args = arguments;

		// TODO: fix this
		if( $typeOf(arguments[0]) == 'string'  && arguments[1] ) {
			obj[arguments[0]] 	= arguments[1];
			args				= [obj];
		}
		for (var i = 0, l = args.length; i < l; i++)  {
			$extend(this.prototype, args[i]);

			// ADDED: 03.06.09
			// An easy way to change default options for a class
			if(args[i] && args[i].constructor === Options) {
				this.setOptions = $extend.bind(this.prototype.options);
			}
			/*
			if(args[i] && args[i].constructor === Events) {
				['addEvent', 'addEvents', 'removeEvent', 'removeEvents'].each( function(event, index) {
					this.consturctor[event] = args[i][event].bind(
				}, this);
				this.addEvent = args[i].constructor.
			}
			*/
		}


		return this;
	},

	// var Animal 	= new Class();
	// var Cat 		= Animal.extend({});
	extend		: function( properties  ) {
		var proto 	= new this(null);
		var hash	= {};
		var _class;

		// Traverse through given properties
		for (var property in properties){
			var pp 			= proto[property];
			proto[property] = Class.Merge(pp, properties[property]);
		}

		proto.constructor = this; // GP

		// Attach .parent to functions not already merged (and thus having .parent registered)
		// Added by GP: 25/11/08
		for(var i in proto) {
			if($typeOf(proto[i]) === 'function' && !proto[i].parent) {
				proto[i].parent = proto[i];
			}
		}

		_class = new Class(proto);

		// ADDED: 01 July 09
		// Implement setOptions for Class extensions too
		if(this.setOptions) {
			_class.setOptions = $extend.bind(_class.prototype.options);
		}

		return _class;
	}
}

// Internal
// Dean's work
Class.Merge = function(previous, current){
	if (previous && previous != current){
		var type = $typeOf(current);

		if (type != $typeOf(previous)) {
			return current;
		}

		switch(type){
			case 'function':
				var merged = function(){
					this.parent = arguments.callee.parent;
					return current.apply(this, arguments);
				};

				merged.parent = previous;
				return merged;

			case 'object':
				return $merge(previous, current);
		}
	}
	return current;
};



// Global functions
// ================================================================================
$typeOf	= $type =  function(obj){
	var type, ret;

	if(obj === null || obj === undefined) {
		return false;
	}

	if(obj.ID && obj.ID.type) {
		return obj.ID.type;
	}

	// window check
	if(obj.window) {
		obj.ID = { type : 'window' }
		return 'window';
	}

	type = typeof(obj);
	if (type == 'object' && (obj.extented && obj.type) ||  (obj.target || obj.srcElement)) {
		// Double check
		// Changed: 19/10/08 by gp
		if(obj.type) {
			obj.ID = { type : 'event' }
			return 'event';
		}
	}


	if (type == 'object' && obj.nodeName){
		switch(obj.nodeType){
			case 1: ret =  'element'; break;
			case 3: ret = (/\S/).test(obj.nodeValue) ? 'textnode' : 'whitespace'; break;
		}
		obj.ID = { type : ret }
		return ret;
	}

	if (obj.length !== undefined && typeof obj.length == 'number') {
		if (obj.item)		ret 	= 'collection';
		if (obj.callee) 	ret 	= 'arguments';

		if(!window.ie) {
			obj.ID = { type : ret }
		}

		return ret;
	}

	return type;
};

$is  = function(obj)		{
	// CHANGED: beter way
	return !(obj === null || typeof(obj) === 'undefined' || typeof(obj) === 'unknown') &&  (obj || obj === 0);
};

$any = function() 			{
	var item = null, args = $A(arguments);
	for( var i = 0, l = args.length; i < l; i++ ) {
		if( $is(args[i]) ) {
			item = args[i];
			break;
		}
	}
	return item;
};

$uniqueID	= function( obj ) 	{
	if( !this.$UID ) {
		this.$UID		= 0;
	}

	if(!obj.$UID) {
		obj.$UID 		= 'UID' + this.$UID++;
	}

	return obj.$UID
};


$extend = function() {
	var args 		     = arguments;
	if( !args[1] ) args = [this,args[0]]; // Missing first argument?
	if( !args[1] ) return args[0];


	for (var p in args[1]) {
		// We need to force a try / catch kinda thing here.
		// Otherwise we may end up with erors on IE
		try{
			args[0][p] = args[1][p];
		} catch(ex) {
			console.error('Failed to extend : ' + args[0] + ', to : ' + p);
		}
	}

	return args[0];
};

$merge	= function(){
	var mix = {}, ap, mp;
	for (var i = 0; i < arguments.length; i++){
		for (var property in arguments[i]){
			ap 		= arguments[i][property];
			mp 		= mix[property];

			// CHANGED: fix this, mootools has an additional mp &
			// if (mp && $typeOf(ap) == 'object' && $typeOf(mp) == 'object') {
			if ($typeOf(ap) == 'object' && $typeOf(mp) == 'object') {
				mix[property] = $merge(mp, ap);
			}
			else mix[property] = ap;
		}
	}
	return mix;
};


$now	= function() 				{ return new Date().getTime(); };


$T		= function( tags, root ) {
	if(!tags.push) {
		tags = [tags];
	}

	return ($(root) || document).getElements(tags.join(','));
};


//$rnd	= function( min, max) 		{ return min + Math.random() * ( max - min + 1);  };
$rnd	= function( min, max) 		{ return min + (Math.random() * ( max - min ));  };

$A	= function( arg, start) {
	var newArray = [], type = $typeOf(arg);
	if(type === 'string' ) {
		return arg.toArray();
	}

	if(type === 'object') {
		each(arg, function(item) {
			newArray.push(item);
		});
		return newArray;
	}

	// Default
	start = start || 0;

	// Arguments? Do it the fast way
	if(start !==0 && type === 'arguments') {
		return Array.prototype.slice.call(arg);
	}

	if (start < 0) {
		start = arg.length + start;
	}

	var length = length || (arg.length - start);

	for (var i = 0; i < length; i++) {
		newArray[i] = arg[start++];
	}

	return newArray;
};

$clear	=  function( timer ) {
	clearInterval 	(timer);
	clearTimeout  	(timer);
	return 			( (timer = null) );
};

$forEach  = each = function(  obj, fn, context ) {
	for (var property in obj)	{
		// Skip extend (Abstracts)
		if( !( property === 'extend' && $typeOf(obj[property]) === 'function' ) ) {
			fn.call(context, obj[property], property);
		}
	}
};

// ================================================================================
// Abstract
// ================================================================================
Abstract = function( obj ) {
	obj 		= obj || {};
	obj.extend 	= $extend;
	return obj;
}

// ================================================================================
// Prototypes
// ================================================================================
var prototypes = [Array, String, Date, Number, Function, RegExp, Boolean, window.HTMLElement];
for(var i = 0, l = prototypes.length; i < l; i++ ) {
 	prototypes[i].extend = function() {
		$extend(this.prototype, arguments[0]);
	}

	prototypes[i].prototype.ID 			= { type : ['array', 'string', 'date',  'number',  'function', 'regexp', 'boolean'][i] }
};


// Date
Date.extend({

	// Emulate Common's dt function
	dt			: function() {
		var today 	= new Date(), day, month, year, minutes;
		var tsToday	= today.clone().set('-1 day midnight').getTime(), tsNow = $now(), ts = this.getTime();
	   var days 	= ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
		var months  = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαι', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπτ', 'Οκτ', 'Νοε', 'Δεκ']

		var diff	= (tsNow - ts) / 1000;	// In secs


		var	month 	= this.format('n').toInt(); // TODO: Array
		var	day		= this.format('j');
		var	year	= this.format('y');


		var monthSt = months[month-1] + '.';

		// Null time (midnight)
		if(this.format('Hi') === '00') {
			if( this.format('Y').toInt() !== today.getFullYear().toInt()) {
				return this.format('j/n/Y');
			} else {
				return this.format('j/n');
			}
		}

		// Later on
		if(ts > tsNow) {
			if(year != today.getFullYear()) {
				return day + ' ' + monthSt + ' ' + year;
			} else {
				return day + ' ' + monthSt;
			}
		}

		// Minutes
		if(diff < 300) {
			if(diff < 60 && diff > 0) {
			 	return 'πριν ' + diff + '\'\'';
			} else if (diff < 60) {
				return 'πριν 1 λεπτό';
			} else {
				return 'πριν ' + parseInt((diff/60+1)) + '\'';
			}
		} else if( diff < 3600 ) {
			return 'πριν ' + parseInt(( (diff / 60) / 10)  * 10) + '\'';
		} else if( diff < 7200 ) {
			minutes = ((( (diff - 3600) / 60 ) / 5) * 5).toInt();
			return 'πριν 1 ώρα' + ( minutes ? ' & ' + minutes + '\''  : '');
		} else if (diff < 10800 ) {
			minutes = (( ((diff - 7200) / 60) / 5) * 5).toInt();
			return 'πριν 2 ώρες' + ( minutes ? ' & ' + minutes + '\''  : '');
		}

		if(ts < tsToday) {
			if( ts >= tsToday - 86400 * 1000 && this.format('Hi').toInt() > 400 ) {
				return this.format('χτές H:i');
			} else if ( ts >= tsToday - 86400 * 1000  * 5) {
				return days[this.format('w').toInt()] + ' ' + this.format('H:i');
			} else {
				if(this.getFullYear() !== today.getFullYear() ) {
					return day + ' ' + monthSt + ' ' + year;
				} else {
					return day + ' ' + monthSt;
				}
			}
		} else {
			return this.format('H:i');
		}
	}
});

// Array
Array.extend({
	forEach			: function(fn, context){
		for (var i = 0, j = this.length; i < j; i++)  {
			fn.call((context || this[i]), this[i], i, this);
		}
	},

	map				: function(fn, context)			{
		var results = [];
		var lala = function() {
			return this;
		};
		for (var i = 0, j = this.length; i < j; i++) {
			results[i] = fn.call(context, this[i], i, this);
		}

		return results;
	},

	indexOf 		: function( value ) 	{
		for (var i = 0 ; ( thisItem = this[i] ); i++ ) 	{
			// Special care for date items
			if($typeOf(thisItem) === 'date' && $typeOf(value) === 'date' ) {
				if( thisItem.getTime() === value.getTime() ) {
					return i;
				}
			} else {
				if( thisItem == value )	{
					return i;
				}
			}
		}
		return -1;
	},

	empty			: function()			{ this.length = 0; return this;},

	/*
	// Extension
	toJSON_ext		: function() {
		var results = [];
		this.each(function(object) {
			var value = $toJSON(object);
			if (value !== undefined) {
				results.push(value);
			}
		});
		return '[' + results.join(', ') + ']';

	},
	*/

	shuffle			: function() 			{
		// TODO: study this loop
		for(var j, x, i = this.length; i; j = parseInt(Math.random() * i), x = this[--i], this[i] = this[j], this[j] = x);
		return this;
	},

	clone			: function()		{ return $A(this);},

	rnd				: function() 		{ return this[$rnd(0, this.length)] },

	every			: function(fn, context){
		for (var i = 0, j = this.length; i < j; i++)
			if (!fn.call(context, this[i], i, this)) {
				return false;
			}
		return true;
	},

	filter			: function(fn, context){
		var results = [];
		for (var i = 0, j = this.length; i < j; i++)
			if (fn.call(context, this[i], i, this)) {
				results.push(this[i]);
			}
		return results;
	},

	remove 			: function(item){
		var i = 0, len = this.length;
		while (i < len){
			if (this[i] === item){
				this.splice(i, 1);
				len--;
			} else 	i++;
		}
		return this
	},

	contains 	: function( item ) 	{ return !!(this.indexOf( item ) != -1 ); },

	extend		: function( array )  {
		for (var i = 0, j = array.length; i < j; i++) {
			this.include(array[i]);
		}
		return this;
	},

	getLast		: function()		{ return this[this.length - 1] },

	clone		: function()		{ return [].concat(this);		},

	include		: function(item)	{ if(!this.contains(item) ) this.push(item); return this}
});
Array.prototype.each 	= Array.prototype.forEach;
Array.prototype.copy	= Array.prototype.clone;


// String
String.extend({
	escapeRegExp	: function() 		{
		return this.replace(/([.*+?^${}()|[\]\\])/g, '\\$1');
		// TODO: I removed the \/. Did i do wrong?
		//return this.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1');
	},

	reverse			: function() 		{ return $A(String(this)).reverse().join(''); },

	// http://blog.stevenlevithan.com/archives/faster-trim-javascript
	trim			: function()		{ return this.replace(/^\s\s*/, '').replace(/\s\s*$/, ''); },

	trimLeft		: function()		{ return this.replace( /^\s+/g, '');},

	trimRight		: function()		{ return this.replace( /\s+$/g, '');},

	stripScripts 	: function() 		{ return this.replace( new RegExp( '(?:<script.*?>)((\n|\r|.)*?)(?:<\/script>)', 'img'), ''); },

	toArray			: function() 		{ return this.split(''); },

	// From PHP:
	// Returns a string with backslashes stripped off. (\' becomes ' and so on.)
	// Double backslashes (\\) are made into a single backslash (\).
	stripSlashes	: function()		{ return this.replace(/\\('|")/g, '$1').replace(/\\{2}/g, '\\') },

	addSlashes		: function( doubleOnly ) 		{
		var self = this.replace( /"/g, "\\\"");
		if(!doubleOnly) {
			self = self.replace( /'/g, "'\\'");
		}
		return self;
	},

	camelCase		: function()		{ return this.replace(/-\D/g, function(match){return match.charAt(1).toUpperCase();	} ) },

	hyphenate: function()				{
		return this.replace(/\w[A-Z]/g, function(match){
			return (match.charAt(0) + '-' + match.charAt(1).toLowerCase());
		});
	},

	/*
	// Extension
	toJSON_ext				: function() {
		// CHANGED: 21.05.2009
		return '"' + this.addSlashes().replace(/'/g, '\\\'') + '"';
		//	return '\'' + this.addSlashes().replace(/'/g, '\\\'') + '\'';
	},
	*/

	// Json test regexp is by Douglas Crockford <http://crockford.org>.
	evalJSON			: function() 		{
		// FF 3.1 , IE8 for now
		// If missing, we use the JSON object defined here (see JSON)
		var string = this.toString();
		if(typeof(JSON) !== 'undefined'  && JSON.parse) {
			// Wee need an exception here for IE8
			try{
				return JSON.parse(string);
			} catch(ex) {
				return null;
			}
		}
		// OBSOLETE METHOD
		// return (  !(/^("(\\.|[^"\\\n\r])*?"|[,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t])+?$/.
		// test(String(this))) ) ? null : eval('(' + String(this) + ')');
	},

	contains 		: function(needle) 	{ return this.indexOf( needle ) != -1; },

	escapeHTML		 : function(singleQuotes) 		{
		 var self 	= arguments.callee; // A nice way to refenrece to this
		 var string = this.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
		 return singleQuotes ?	string.replace(/'/g, '&#039;')  : string.replace(/"/g, '&quot;');
	},

	unescapeHTML	: function() 		{ return this.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');	},

	capitalize		: function()		{ return this.charAt(0).toUpperCase() + this.substring(1).toLowerCase(); },

	pad				: function(length, padder) {
		length	= length || 2;
		padder	= padder || '0';

		for( var i = 0, str= ''; i < length - this.toString().length - padder.length + 1; i++ ) {
			str += padder;
		}

		return str + this;
	},

	toInt			: function() {
		var res = parseInt(this, 10);
		return !isNaN(res) ? res : 0;
	},

	toFloat			: function() { return parseFloat(this); },

	// 12340.2044 to 12,340.20
	toFormatted		: function( seperator, radix ) {
		// Figure out default radix
			var self = this;
			// Figure out default radix
			radix 				=== undefined && (function() {
				radix = self.toString().indexOf('.') !== -1 ? self.toString().replace(/^.+\./, '').length : 0;
			})();

		// Figure out seperators ( . OR ,)
		seperator			= seperator || '.';
		var seperatorDec 	= seperator == '.' ? ',' : '.';

		// Get sign, integer and decimal
		var match = String(this.toFixed(radix)).match( /^(\-)?(\d+?)(\.(\d+)?)?$/);

		return ((match[1] || '')  +
		match[2].reverse().replace( /(\d{3})(?!$)/g, '$1' + seperator ).reverse() +
		( match[4] ? 	(seperatorDec || ',' ) + match[4] : '' )).
		replace(new RegExp((seperator + seperatorDec).escapeRegExp()), seperatorDec);			// Lame:(
	}
});

Number.prototype.toFormatted = String.prototype.toFormatted;
Number.prototype.pad = String.prototype.pad;

Function.extend({
	bind 			: function() {
		var fn 						= this;
		var args					= $A(arguments);
		var context 				= args.shift();
		var $method					= $uniqueID(fn);

		// Shit happens :)
		if(fn === null) {
			return null;
		}


		//fn 							= null;

		// TODO: use the global type here?
		// Mind the !e.extended - we want to avoid already extended event objects
		var isEvent 				= function(e) {	return e && e.type   && !e.extended && (e.target || e.srcElement !== undefined);}

		var bound = function() 	{
			// Prevent errors
			if(typeof($A) === 'undefined') {
				return null;
			}


			// TODO: Finalize this
			// In case we are providing additional arguments to the bound function
			// Extend them to the original args.
			// Special care to the event (if given);
			var boundArgs 		= $A(arguments) || [];
			var evt	 			= boundArgs.getLast(), boundPopped;
			var boundArgsAll 	= $A(args);

			// In case we are dealing with an event
			if( isEvent(evt)) {

				if(isEvent(boundArgsAll.getLast())) {
					boundArgsAll.pop();
				}

				if(( boundPopped = boundArgs.pop()) && boundPopped.length) {
					boundArgsAll.extend( boundArgs );
				}
				boundArgsAll.push(evt);
				//boundArgsAll.push($E(evt));
			} else {

				boundArgsAll = boundArgsAll.concat(boundArgs);
				// CHANGED: extend does unique concat  prefere concat here
				//$A(boundArgsAll).extend(boundArgs);
			}
			if(context && context.nodeType && context.nodeType == 1) {
				context = $(context);
			}


			return fn.apply(context, boundArgsAll);

		}

		bound.bound			= true;
		return bound;
	},

	delay 			: function(msecs, context) {
		var self 	= this;
		var args	= arguments;

		var fn 		= function() {
			return	self.apply(context, $A(args).slice(2) );
		}


		// Insant execution
		if(msecs === - 1) {
			fn();
			return -1;
		}

		return setTimeout (fn, msecs);
	},

	periodical 		: function(msecs, context) {
		var self 	= this;
		var args	= arguments;
		var fn 		= function() {
			return	self.apply(context, $A(args).slice(2) );
		}
		return setInterval (fn, msecs);
	}

});

// Element extensions
window.HTMLElement.extend({
	set			: function( properties ) {
		this.ID 		= this.ID || {};
		this.ID.type  	= 'element';

		if(!properties || $typeOf(properties) !== 'object') {
			return this;
		}

		for( var property in properties ) {
			switch( property ) {
				case 'styles' :
					this.setStyles(  properties[property] );
					break;
				case 'events':
					this.addEvents( properties[property] );
					break;
				case 'properties':
					this.setProperties( properties[property] );
					break;
				case 'methods':
					this.addMethods( properties[property] );
					break;
				default:
					switch( $typeOf( properties[property] ) ) {
						case 'function':
							this.addMethod( property, properties[property] );
							break;
						default:

						this.setProperty(property, properties[property] );
					}
					break;
			}
		}
		return this;
	},

	setHTML 	: function( html )	 {
		if( html === undefined || html === null) {
			html = '';
		}
		html = html.toString();
		this.innerHTML = html;

		return this;
	},

	// Non-element returns
	hasClass	: function( className ) {
		if( this.className == className ) return true;

		if( $typeOf(className) == 'array' ) {
			className = '(' + className.join('|') + ')';
		}

		return new RegExp('(^| )'+className.escapeRegExp()+'($| )').test(this.className.toString());
	},

	addClass	: function( className ) {
		if( !this.hasClass( className )) {
			this.className += ((this.className  ? ' ' : '') + className);
		}
		return this;
	},

	removeClass	: function( className ) {
		this.className = this.className.replace(new RegExp( '(^| )'+className.escapeRegExp()+'( |$)'), ' ' ).trim();
		return this;
	},


	setStyle	: function (style, value) {
		if( arguments.length == 1 && $typeOf(style) == 'string' ) 	return this.setProperty( 'style', style );
		if( style == 'float' ) style = window.ie ? 'styleFloat' : 'cssFloat';
			if( style == 'opacity' ) this.setOpacity( parseFloat(value) );
		else {
			switch($typeOf(value)){
				case 'number': if (!['z-index', 'zoom'].contains(style)) value += 'px'; break;
				case 'array': value = 'rgb(' + value.join(',') + ')';
			}
			try {
				this.style[style.camelCase()] = value.toString();
			} catch(ex) {
				alert([style, value]);
			}
		}

		return this;
	},

	addEvent	: function(type, fn) {
		this.addEventListener(type, fn.bind(this), false);
		return this;
	},

	removeEvent	: function(type, fn) {
		this.removeEventListnener(type, fn);
		return this;
	},

	getText		: function() {
		return this.textContent;
	},

	// for now
	removeEvents	: function(type, fn) {
		return this.removeEvent(type, fn);
	},

	setStyles	: function( css ) {
		each( css, function( value, style  ) {
			this.setStyle( style, value );
		}, this );
		return this;
	},

	getPosition	: function() {
		var box = elem.getBoundingClientRect(), doc = elem.ownerDocument, body = doc.body, docElem = doc.documentElement,
		clientTop = docElem.clientTop || body.clientTop || 0, clientLeft = docElem.clientLeft || body.clientLeft || 0,
		top  = box.top  + (self.pageYOffset || jQuery.support.boxModel && docElem.scrollTop  || body.scrollTop ) - clientTop,
		left = box.left + (self.pageXOffset || jQuery.support.boxModel && docElem.scrollLeft || body.scrollLeft) - clientLeft;
		return { top: top, left: left };
	},

	getProperty		: function(property) {
		var flag = 0, attribute;
		return  ( attribute = this.attributes[property] ) && attribute.specified ? attribute.nodeValue : null;
	},

	getProperties  : function( ) {
		var obj = {};
		$A(arguments).each( function(prop) {
			obj[prop] = this.getProperty(prop);
		}, this );
		return obj;
	},

	setProperty		: function( property, value ) {
		if( property == 'style' )  {
			this.style.cssText = value.toLowerCase();
			return this;
		}

		var index = Element.Properties[String(property)];
		if (index) {
			this[index] = value;
		} else {
			if(!(window.ie && this.nodeName === 'FORM')) {
				// Remove it if null
				if(value === null) {
					this.removeProperty(property)
				} else {
					this.setAttribute(property, value);
				}
			} else {
				this.attributes[property].nodeValue = value;
			}
		}
		return this;
	},

	setProperties	: function( properties ) {
		each( properties, function( value, property  ) { this.setProperty( property.trim(), value )}, this );
		return this;
	},

	removeProperty	: function(property) {
		var index = Element.Properties[String(property)];
		if (index) {
			this[index] = null;
		} else {
			if(this.removeAttribute) {
				this.removeAttribute(property);
			} else {
				this.attributes[property].nodeValue = null;
			}
		}

		return this;
	},

	'setClass'	: function(className) {
		this.className = className;
		return this;
	},

	getElements	: function(selector) {
		return Array.prototype.slice.call(this.querySelectorAll(selector));
	},

	getElement : function(selector) {
		return this.querySelector(selector);
	},

	injectIn	: function(target) {
		target.appendChild(this);
		return this;

	},

	injectBefore : function(before) {
		before.parentNode.insertBefore( this, before);
		return this;

	},

	traverse	: function( relative, index, target, fn, start){
		var elements = [], el = (start ? this[start] : this[relative]), indexCounter = 0;
		while( el ) {
			if ( el.nodeType == 1 ) {
				elements.push($(el));
				if( $is(index)  && ( indexCounter++ == index  )  ) 	break;
				if( $is(target) && ( target == el )  ) 				break;
				if( fn && fn.call(el,el) ) 	{	break;	}
			}
			el = el[relative] ;
		}
		return elements;
	},


	getFirst	: function(index) { return this.getChild(index || 1);},

	getLast		: function(index) { return this.traverse( 'previousSibling', index || 1, null,  null, 'lastChild')[0]; },

	getNext		: function(index) { return $(this.traverse( 'nextSibling', 1)[index || 0]);},

	getPrevious	: function(index) { return $(this.traverse( 'previousSibling', 1)[index || 0]);},

	show		: function() {
		this.style.display = 'block';
		return this;
	},

	hide		: function() {
		this.style.display = 'none';
		return this;
	},

	remove		: function() {
		this.parentNode.removeChild(this);
		return this;
	}

});



// ================================================================================
// $, $E, $C
// ================================================================================
$ = function (element, properties) {
	// NEEDED
	if(!document) {
		return null;
	}
	if( $typeOf(element) == 'string') {
		var elementString = element;
		// Support selectors if available
		// Fixed a bug with g
		if( ![' ', '<', '[', ']'].contains(element[0]) &&  /[#\. >]/.test(element)) {
			element =  $$(element)[0];
		} else {
			element = document.getElementById(element);
		}
	}

	// No element found
	if(!element) {
		return null;
	}

	element.ID 				= element.ID || {};
	element.ID.type			= 'element';

	if( !element.uniqueID ) {
		element.uniqueID		=  $uniqueID(element);
	}

	return element.set(properties);
}


$C = function(name) {
	return document.createElement(name);
}

// ================================================================================
// Chain class
// ================================================================================
var Chain = new Class({
	chain	: function(fn) {
		this.chains = this.chains || [];
		this.chains.push(fn);
		return this;
	},

	callChain : function(){
		// Added support for arguments
		// ADDED: 25.06.2008
		var realFn, self = this, args = $A(arguments);
		if (this.chains && this.chains.length) {
			realFn 	= this.chains.shift();
			(function() {
				return 	realFn.apply(self, args.slice(0));
			}).delay(10, this);
			// The old way around
			// this.chains.shift().bind(this, $A(arguments)[0]).delay(10, this);
		}
		return this;
	},

	clearChain	: function() {
		this.chains.empty();
		return this;
	}
});


// ================================================================================
// Options class
// ================================================================================
var Options 	= new Class({
	setOptions			: function() {
		if( !arguments) return;
		// PRETTY useful for mergin
		this.options = $merge.apply( null, [this.options].extend( arguments) );

		// Handle events
		if( this.options['events'] ) 	each( this.options['events'], function( fn, event ) { this.addEvent( event, fn); }, this );

		// Legacy reasons
		// TODO: fix this mess
		each( this.options, function( value, key ) {
			if( key.indexOf( 'on') === 0 && $typeOf(value) == 'function'  ) {
				this.options[key] = null;
				var newKey 	=  key.replace( /on/, '');
				newKey		= newKey.charAt(0).toLowerCase() + newKey.substr(1);
				this.addEvent(newKey, value )
			}
		}, this	);

		// Fix the functions scope
		each( this.options, function( fn, name) {
			var self = this;
			if( $typeOf(fn) == 'function' )	{ this.options[name] = function() { return fn.apply(self, arguments); };}
		}, this);

		return this;
	}
});

// ================================================================================
// Events class
// ================================================================================
Events = new Class({
	addEvent	: function( type, fn) {
		if (fn != Class.empty && $typeOf(fn) == 'function' ){
			this.events 			= this.events 			|| {};
			this.events[type] 		= this.events[type] 	|| [];
			this.events[type].remove(fn); // Remove it first
			this.events[type].include(fn);
		}
		return this;
	},

	removeEvent	: function(type, fn) {
		if(this.events && this.events[type]) {
			if(fn) {
				this.events[type].remove(fn);
			} else {
				// Remove all events if no fn is given
				this.events[type] = null;
			}
		}
		return this;
	},


	hasEvent	: function(type) {
		return( !!(this.events && this.events[type]) );
	},

	invokeEvent	: function() {
		var args = $A(arguments), type = args.shift();

		if (this.events && this.events[type]){
			this.events[type].each(function(fn) {
				fn.apply(this, args);
			}, this);
		} else {
			//alert(this['on'+type.toCapitalize]);return;
			// For on related left out of setOptions
			// or added later on
			if(this['on'+type.capitalize()] && $typeOf(this['on'+type.capitalize()]) === 'function') {
				this['on'+type.capitalize()].apply(this, args);
			}
		}
		// Global broadcasting
		if( type != 'event' ) {
			this.invokeEvent( 'event', type, args );
		}
		return this;
	}

});


// Used internally
// TODO: is this extended check valid??
$E = function(event) { return  event.extended ? event : new Element.Event( event || window.event );}

// ================================================================================
// Element.Event class
// ================================================================================
Element.Event 		= new Class({
	initialize					: function(event) {
		event		 				= event || window.event;
		this.type					= event.type;
		this.extended				= Core.empty;

		this.target 				= $(event.target || event.srcElement);
		this.currentTarget			= event.currentTarget || this.target;
		this.eventPhase				= event.eventPhase;

		if(this.target && this.target.nodeType == 3) {
			this.target = $(this.target.parentNode);
		}

		this.layerX					= event.layerX || event.offsetX;
		this.layerY					= event.layerY || event.offsetY;

		// > http://adomas.org/javascript-mouse-wheel/
		if (['DOMMouseScroll', 'mousewheel'].contains(this.type)) {
			this.wheel = (event.wheelDelta) ? event.wheelDelta / 120 : - (event.detail || 0) / 3;
		}
		else  if( /click|mouse|menu/.test(this.type ) ) {
			try {
				this.page = {
					'x': event.pageX || event.clientX + window.getBody().scrollLeft,
					'y': event.pageY || event.clientY + window.getBody().scrollTop
				};
				this.client = {
					'x': event.pageX ? event.pageX - window.pageXOffset : event.clientX,
					'y': event.pageY ? event.pageY - window.pageYOffset : event.clientY
				};
			} catch(ex) {
				// This is throw in case we mousover ton object
				// or embed element (occasionally)
			}

			if( ['mouseover', 'mouseout'].contains(event.type)) {
				if(!event.relatedTarget) {
					if(window.ie) {
						try {
							this.relatedTarget = $((event.type == 'mouseover' ? event.fromElement : event.toElement));
						} 	catch (ex) {}
					}
				} else {
					// avoid 'anonymous-div' (XUL) related errors
					try { this.relatedTarget = $(event.relatedTarget);}
					catch(ex) {this.relatedTarget = null; }
				}

				if( this.relatedTarget && this.relatedTarget.nodeType !== 1) {
					try {this.relatedTarget = this.relatedTarget.parentNode;}
					catch (ex) { this.relatedTarget = this.target; }
				}

				this.relatedTarget = this.relatedTarget || null;
			}


			this.rightClick			= (event.which == 3 ) || (event.button == 2) 	|| null;
			this.middleClick		= (event.which == 2 ) || (event.button == 4) 	|| null;
			this.leftClick			= (event.which < 2  || event.button < 2 ) 		|| null;
		} else if ( this.type.contains('key') ) {
			this.code 	= event.which || event.keyCode;

			// THIS CAUSE AN ISSUE WITH IE
			for (var key in Element.Event.keys ) {
				if(parseInt(Element.Event.keys[key]) == parseInt(this.code) ) {
					this.key = key.toLowerCase();
					break;
				}
			}

			if( this.type == 'keydown' ) {
				var fKey = this.code - 111;
				if (fKey > 0 && fKey < 13) {
					this.key = 'f' + fKey;
				}
			}

			this.key = this.key || String.fromCharCode(this.code).toLowerCase();
		}

		this.alt			= event.altKey;
		this.meta			= event.metaKey;
		this.shift			= event.shiftKey;

		if(!this.shift && event.modifiers) {
			this.shift = !!(event.modifiers & 4);
		}

		this.ctrl			= event.ctrlKey || this.key == 'ctrl';
		this.timestamp   	= $now()
		this.event			= event;
		this.ID				= {  type : 'event' }

		return this;
	},

	stop				: function() {
		return this.stopPropagation().preventDefault();
	},

	stopPropagation		: function() {
		if (this.event.stopPropagation) {
			this.event.stopPropagation();
		} else {
			// TODO: Fix this / sometimes we get a "Member not found" error out of nowhere
			try{
				this.event.cancelBubble = true;
			} catch(ex){};
		}
		return this;
	},

	preventDefault	 : function() {
		if( this.event.preventDefault ) {
			this.event.preventDefault();
		}  else  {
			// TODO: Fix this / sometimes we get a "Member not found" error out of nowhere
			try {
				this.event.returnValue = false;
			} catch(ex) {}
		}
		return this;
	}

});

Element.Event.checkRelatedTarget  = function(event) {
	var relatedTarget = event.relatedTarget;
	if(!relatedTarget) {
		return true;
	}
	///console.log($typeOf(this) != 'document', relatedTarget != this,  relatedTarget.prefix != 'xul',this.contains(relatedTarget));
	return ($typeOf(this) != 'document' && relatedTarget != this && relatedTarget.prefix != 'xul' && !this.contains(relatedTarget));
}

Element.Event.keys = new Abstract({
	'backspace' 	: 8,
	'tab'			: 9,
	'return'		: 13,
	'shift'			: 16,
	'ctrl'			: 17,
	'alt'			: 18,
	'caps'			: 20,
	'esc'			: 27,
	'space'			: 32,
	'pageup'		: 33,
	'pagedown'		: 34,
	'end'			: 35,
	'home'			: 36,
	'left'			: 37,
	'up'			: 38,
	'right'			: 39,
	'down'			: 40,
	'insert'	 	: 45,
	'delete'	 	: 46
});



// ================================================================================
// Ajax
//
// Examples on setting params
// 1. new Ajax('myAjax.php').send('lala=1');
// 2. new Ajax('post', {url : 'myAjax.php'});
// 3. new Ajax().send('lala=1').chain(...)
// 4. new Ajax({ parameters : { lala : 1 } ).send();
// ================================================================================
Ajax = new Class({
	options			: {
		'method'		: 'POST',
		'asynchronous'	: true,
		'encoding'		: 'iso-8859-7',
		'timeout'		: 20000,
		'mimeType'		: 'text/plain', // If parameters are set, automatically set it to text/html
		'multipart'		: false,
		'queryString'	: '',
		'forceAbort'	: true,
		'username'		: null,
		'password'		: null,
		'encodeURI'		: true,

		'url'			: '' 		// TODO: remove this later
	},

	setXHR				: function() {
		// These versions of XHR are known to work with MXHR (providing proper interactive state)
		// Prefer those as oppsed to standard XMLHttpRequest
		// this.XHR =  new ActiveXObject('MSXML2.XMLHTTP.6.0');
		if(window.ie) {
			try {
				this.XHR = new ActiveXObject('MSXML2.XMLHTTP.6.0')
			} catch(ex) {
				this.XHR = new ActiveXObject('MSXML3.XMLHTTP');
			}
		}
		this.XHR = this.XHR || ( (window.XMLHttpRequest) ? new XMLHttpRequest() : (window.ie ? new ActiveXObject('Microsoft.XMLHTTP') : false));
		return this;
	},

	// For private use only
	_timeOut			: function() { 	return this.abort().invokeEvent( 'timeout' ); },

	_setQueryString		: function() {
		var parameters = [];
		each(this.parameters, function( value, key ) 	{
			if(value !== null) {
				parameters.push( key+ '=' +  (this.options.encodeURI ? encodeURIComponent(value) : value) );
			}
		}, this);
		this.queryString 	= parameters.join('&');
	},

	abort			: function() {
		if( !this.isRunning ) {
			return this;
		}
		this.isRunning				= Ajax.isRunning = this.isSuccess = false;
		this.timer = $clear(this.timer); // nullify timer
		this.XHR.abort();
		this.XHR.onreadystatechange = Core.empty;
		this.isAborted				= true;

		this.setXHR();
		return this.invokeEvent('abort');
	},

	getHeader		: function ( header) {
		// note: getallResponseHeaders is supported from IE7 and on
		try {
			return header ?
			this.XHR.getResponseHeader(header) :
			this.XHR.getAllResponseHeaders();
		} catch(ex) { return null; }
	},

	set 			: function( options ) {
		var parameters = [];

		// Assuming its a queryString
		if( $typeOf(options) == 'string' ) {
			this.queryString 	= options;
		} else {
			this.setOptions(options);
			this.options.method 		= this.options.method.toUpperCase();
			this._setQueryString();
		}


		if( this.options.method == 'GET' ) {
			this.URI = this.options.url +  ( this.queryString ? ( this.options.url.contains( '?') ? '&'  : '?' ) + this.queryString  : '');
		} else {
			this.URI	= this.options.url;
		}


		return this;
	},

	send			: function(parameters) {
		if (this.options.forceAbort && this.isRunning) {
			this.abort();
		}
		else  {
			if( this.isRunning ) {
				return this;
			}
		}

		// This will let us know wether state[1] is already called
		// so we can skip re-calling it.
		this.__startedLoading	= false;

		this.isRunning = Ajax.isRunning = true;
		// We dont want to mess with the options.parameters
		// and query string, we create copies
		this.parameters 	= $merge(this.options.parameters);
		this.queryString	= this.options.queryString;

		//TODO: fix this mess
		if( $typeOf(parameters) != 'string') {
			$extend(this.parameters, parameters);
		}

		// CHANGED: 17.02.09
		var mimeType = this.options.mimeType || '';
		if(mimeType.toLowerCase() === 'text/plain' && this.parameters) {
			// NOT FOR now since we need to have some JSON response on firebug
			//	mimeType = 'text/html';
			//	mimeType = 'application/atom+xml';
		}
		if( this.XHR.overrideMimeType && this.options.mimeType ) {
			this.XHR.overrideMimeType( mimeType );
		}

		// http://www.xulplanet.com/tutorials/mozsdk/serverpush.php
		if( this.options.multipart )				this.XHR.multipart = this.options.multipart;


		this.set(parameters);

		// ADDED: 10 April 09
		// Decache string
		var decacheString = function(string) {
			string = string.replace( /._crnd=\d+/, '');
			return string + ( string.contains( '?' ) ? '&' : '?' ) + '_crnd=' + $now();
		}
		// NOTE: this will cause issues when used for multipart XHR (on IE)
		this.URI = decacheString(this.URI);



		try  {
			this.XHR.open (this.options.method, this.URI, this.options.multipart ? false : this.options.asynchronous, this.options.username, this.options.password);
			if (this.options.asynchronous)  {
				this.onreadystatechange.delay( 10, this, 1);
			}

			this.XHR.onreadystatechange 	= this.onreadystatechange.bind(this);


			each( this.options.headers, function( header, key) {
				this.XHR.setRequestHeader( encodeURIComponent(key), encodeURIComponent(header) );
			}, this );

			// Mandatory
			this.XHR.setRequestHeader( 'X-Core-version', Core.version);

			// Add window.XAjaxAuthToken headers
			if(window.XAjaxAuthToken) {
				// Not yet evaluated
				if( $typeOf(window.XAjaxAuthToken) === 'string') {
					window.XAjaxAuthToken = window.XAjaxAuthToken.evalJSON() || {};
				}

				each(window.XAjaxAuthToken, function(header,key) {
					this.XHR.setRequestHeader( encodeURIComponent(key), encodeURIComponent(header) );
				}, this );
			}

			this.times++;
			this.timeStart 	= $now();
			this.timeEnd 	= this.isAborted = this.isSuccess = null;
			this.invokeEvent( 'send' );

			switch( this.options.method ) {
				case 'POST' :
					this.XHR.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded' + ( this.options.encoding ? '; encoding: ' + this.options.encoding : '') );
					// Force 'Connection: close' for older Mozilla browsers to work
					// around a bug where XMLHttpRequest sends an incorrect
					// Content-length header. See Mozilla Bugzilla #246651.
					if (this.XHR.overrideMimeType && (navigator.userAgent.match(/Gecko\/(\d{4})/) || [0,2005])[1] < 2005)
						this.options.headers.extend( { 'connection' : 'close' } );

					// Mozilla has a bug with the async calls from a different window - the reply object is all trashed
					// up in this case. The solution to this is to just use a closure here with a 0 ms delay.
					// TODO: do it so

					this.XHR.send( this.queryString);
					break;

				case 'GET' 	:
					this.XHR.send();
					break;
			}

			// Force Firefox to handle ready state 4 for synchronous requests
			if (!this.options.asynchronous && this.XHR.overrideMimeType) {
				this.onreadystatechange();
			}
		}
		catch (ex)	{
			if(console && console.log) {
				// console.log(ex, this.URI);
			}
			return this.invokeEvent( 'error', ex);
		}

		if( this.options.timeout > 1000 ) {
			this.timer = this._timeOut.bind(this).delay(this.options.timeout);
		}

		return this;
	},

	onreadystatechange	: function( state ) {
		// Mozilla gets an exception throw here - you abort the thread, it calls
		// the readystatechange as part of the abort, and you're not
		// allowed to look at the status field. So, if we get one
		// just assume the request is aborted.
		var aborted  = false
		var req		 = this.XHR;
		try{ aborted = ( this.XHR.readyState == 4 && this.XHR.status == 0); }
		catch( ex) { aborted = true; }
		switch( parseInt(state) || this.XHR.readyState ) {
			case 1:
				if(!this.__startedLoading) {
					this.invokeEvent('startLoading').invokeEvent('loading');
					this.__startedLoading = true;
				}
				return this;
				break;
			case 2:	return this.invokeEvent('loaded');
			case 3: return this.invokeEvent('interactive', this.XHR);
			case 4:
				// Custom events to be used with loaders
				this.invokeEvent('finishLoading');

				// Avoid memory leaks
				// IE needs to wait a bit before detaching
				(function() {
					 req.onreadystatechange = Core.empty;
				}).delay(10);

				if( aborted) {
					return this;
				}

				this.invokeEvent('complete');
				$clear( this.timer );
				this.responseText		= this.XHR.responseText || '';
				this.responseXML		= this.XHR.responseXML;
				this.responseJSON 		= this.XHR.responseText.evalJSON();
				if( this.XHR.status ) {
					this.status			= $any( this.XHR.status, -1 );
					this.statusText		= $any( this.XHR.statusText, '' );
				}

				// parseerrror bug workaround
				// http://www.ilinsky.com/articles/XMLHttpRequest/
				// TODO: Fix it
				// if(this.responseXML && window.moz && this.responseXML.documentElement.tagName === 'parseerrror') {
				//	console.log('ekei');
				//	this.responseXML = null;
				// }
				// Hooray, yipie
				if( this.status >= 200 || this.status < 300) {
					// Changed @ 17/11/08
					if(!this.options.asynchronous) {
						this.invokeEvent('success');
					} else {
						this.invokeEvent.bind(this, 'success', this).delay(1, this);
					}
					this.callChain(this);
					this.timeEnd	= $now();
					this.time		= this.timeEnd - this.timeStart;
					this.isSuccess	= true;
					this.isRunning 	= false;
				}
				return this;
		}
	},

	initialize	: function() {
		var args = $A(arguments), options;

		// First argument is defined and is a string
		// It can be either the method or the url
		// E.g
		// 1. new Ajax('myAjax.php').send('lala=1');
		// 2. new Ajax('post', {url : 'myAjax.php'});
		// 3. new Ajax().send('lala=1').chain(...)
		if(args[0].toLowerCase) {
			options 				= args[1] || {};

			if ( ['get', 'post'].contains(args[0].toLowerCase()) ) {
				options['method']	= args[0];
			} else {
				options['url']		= args[0];
			}

		} else {
			 options 				= args[0];
		}

		this.options['parameters'] 	= {};
		this.options['headers']		= {};
		this.times					= 0;

		this.setXHR();
		if( !this.XHR ) return invokeEvent( 'error', "Can't set up XHR" );
		return this.set(options);
	}
});
Ajax.implement( new Chain, new Events, new Options );


Ajax.RPC		= Ajax.extend({
	initialize	: function() {
		var options 				= this.getRPCOptions.apply(this, arguments);
		options.url					= Ajax.RPC.proxy;

		return this.parent( 'post', options);
	},

	getRPCOptions	: function(){
		var args = arguments, rpcQueryString = '', rpcMethod = '', options;

		if( $typeOf(args[0]) == 'array' ) {
			args = args[0];
		} else if($typeOf( args[0] ) == 'object' ){
			return args[0];
		} else {
			args = $A(arguments);
		}

		options = args.pop();
		if( $typeOf( options ) != 'object' ) {
			options  = {};
			args	 = $A(arguments);
		}
		options.parameters 	= options.parameters || new Abstract();
		rpcMethod 			= args.shift();

		args.each( function( value, index ) {
			// ADDED: 15.07.2008
			if(value === null) {
				return;
			}



			if( $typeOf( value ) == 'string' ) 	{
				value 			= value.trim();

				// Step 0: We need to escape \" with \\" first
				value = value.replace(/\\"/gi, '\\\\"');

				// Step1: Escape " (/") in order for eval to work properly
				value = value.replace(/\"/gi, '\\\"');

				// Step2: Escape last trailing slash / (//) in order for eval to work properly
				value			= value.replace(/\\$/g, '\\\\');

				if(value.match(/^\(float\)/)) {
					rpcQueryString += value.replace(/\(float\)/, '');
				} else {
					rpcQueryString	+= '"' + value + '"';
				}


			} else if($typeOf(value) == 'array') {
				rpcQueryString += 'array(' + value.join(',').replace(/\"/gi, '\\\"') + ')';
			} else rpcQueryString += value;

			if( index < args.length -1 ) rpcQueryString += ', ';

		});

		// Figure out document.characterSet
		// For the browsers that have no clue what is
		if(!document.characterSet) {
			var metas = document.getElementsByTagName('meta');
			for(var i = 0; i < metas.length; i++ ) {
				if(metas[i] && metas[i].content && metas[i].content.toLowerCase().indexOf('charset') !== -1) {
					document.characterSet =  metas[i].content.replace(/^.*charset.*?=(.*?)$/, '$1').replace(/;/, '').trim();
					break;
				}
			}
		}

		// Hold it up (I hate typos)
		this.rpcMethod = this.rpcMethod = rpcMethod;
		$extend(options.parameters, {
			rpcQuery 	: '"' + rpcMethod + '", ' + rpcQueryString,
			port		: this.options.port 	|| null,
			host		: this.options.host 	|| null,
			api			: this.options.api 		|| null,
			ttl			: this.options.ttl		|| null,
			charset		: (document.characterSet).toLowerCase()
		});

		return options;
	},

	send		: function() {
    return this.parent(arguments.length ? this.getRPCOptions.apply(this, arguments).parameters : this.parameters);
	}
});
Ajax.RPC.proxy = '/gateway.php';








if (!this.JSON) {
    JSON = {};
}
(function () {

    function f(n) {
        // Format integers to have at least two digits.
        return n < 10 ? '0' + n : n;
    }

    if (typeof Date.prototype.toJSON !== 'function') {

        Date.prototype.toJSON = function (key) {

            return this.getUTCFullYear()   + '-' +
                 f(this.getUTCMonth() + 1) + '-' +
                 f(this.getUTCDate())      + 'T' +
                 f(this.getUTCHours())     + ':' +
                 f(this.getUTCMinutes())   + ':' +
                 f(this.getUTCSeconds())   + 'Z';
        };

        String.prototype.toJSON =
        Number.prototype.toJSON =
        Boolean.prototype.toJSON = function (key) {
            return this.valueOf();
        };
    }

    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        gap,
        indent,
        meta = {    // table of character substitutions
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
        },
        rep;


    function quote(string) {

// If the string contains no control characters, no quote characters, and no
// backslash characters, then we can safely slap some quotes around it.
// Otherwise we must also replace the offending characters with safe escape
// sequences.

        escapable.lastIndex = 0;
        return escapable.test(string) ?
            '"' + string.replace(escapable, function (a) {
                var c = meta[a];
                return typeof c === 'string' ? c :
                    '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
            }) + '"' :
            '"' + string + '"';
    }


    function str(key, holder) {

// Produce a string from holder[key].

        var i,          // The loop counter.
            k,          // The member key.
            v,          // The member value.
            length,
            mind = gap,
            partial,
            value = holder[key];

// If the value has a toJSON method, call it to obtain a replacement value.

        if (value && typeof value === 'object' &&
                typeof value.toJSON === 'function') {
            value = value.toJSON(key);
        }

// If we were called with a replacer function, then call the replacer to
// obtain a replacement value.

        if (typeof rep === 'function') {
            value = rep.call(holder, key, value);
        }

// What happens next depends on the value's type.

        switch (typeof value) {
        case 'string':
            return quote(value);

        case 'number':

// JSON numbers must be finite. Encode non-finite numbers as null.

            return isFinite(value) ? String(value) : 'null';

        case 'boolean':
        case 'null':

// If the value is a boolean or null, convert it to a string. Note:
// typeof null does not produce 'null'. The case is included here in
// the remote chance that this gets fixed someday.

            return String(value);

// If the type is 'object', we might be dealing with an object or an array or
// null.

        case 'object':

// Due to a specification blunder in ECMAScript, typeof null is 'object',
// so watch out for that case.

            if (!value) {
                return 'null';
            }

// Make an array to hold the partial results of stringifying this object value.

            gap += indent;
            partial = [];

// Is the value an array?

            if (Object.prototype.toString.apply(value) === '[object Array]') {

// The value is an array. Stringify every element. Use null as a placeholder
// for non-JSON values.

                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || 'null';
                }

// Join all of the elements together, separated with commas, and wrap them in
// brackets.

                v = partial.length === 0 ? '[]' :
                    gap ? '[\n' + gap +
                            partial.join(',\n' + gap) + '\n' +
                                mind + ']' :
                          '[' + partial.join(',') + ']';
                gap = mind;
                return v;
            }

// If the replacer is an array, use it to select the members to be stringified.

            if (rep && typeof rep === 'object') {
                length = rep.length;
                for (i = 0; i < length; i += 1) {
                    k = rep[i];
                    if (typeof k === 'string') {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            } else {

// Otherwise, iterate through all of the keys in the object.

                for (k in value) {
                    if (Object.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }

// Join all of the member texts together, separated with commas,
// and wrap them in braces.

            v = partial.length === 0 ? '{}' :
                gap ? '{\n' + gap + partial.join(',\n' + gap) + '\n' +
                        mind + '}' : '{' + partial.join(',') + '}';
            gap = mind;
            return v;
        }
    }

// If the JSON object does not yet have a stringify method, give it one.

    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (value, replacer, space) {

// The stringify method takes a value and an optional replacer, and an optional
// space parameter, and returns a JSON text. The replacer can be a function
// that can replace values, or an array of strings that will select the keys.
// A default replacer method can be provided. Use of the space parameter can
// produce text that is more easily readable.

            var i;
            gap = '';
            indent = '';

// If the space parameter is a number, make an indent string containing that
// many spaces.

            if (typeof space === 'number') {
                for (i = 0; i < space; i += 1) {
                    indent += ' ';
                }

// If the space parameter is a string, it will be used as the indent string.

            } else if (typeof space === 'string') {
                indent = space;
            }

// If there is a replacer, it must be a function or an array.
// Otherwise, throw an error.

            rep = replacer;
            if (replacer && typeof replacer !== 'function' &&
                    (typeof replacer !== 'object' ||
                     typeof replacer.length !== 'number')) {
                throw new Error('JSON.stringify');
            }

// Make a fake root object containing our value under the key of ''.
// Return the result of stringifying the value.

            return str('', {'': value});
        };
    }


// If the JSON object does not yet have a parse method, give it one.

    if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text, reviver) {

// The parse method takes a text and an optional reviver function, and returns
// a JavaScript value if the text is a valid JSON text.

            var j;

            function walk(holder, key) {

// The walk method is used to recursively walk the resulting structure so
// that modifications can be made.

                var k, v, value = holder[key];
                if (value && typeof value === 'object') {
                    for (k in value) {
                        if (Object.hasOwnProperty.call(value, k)) {
                            v = walk(value, k);
                            if (v !== undefined) {
                                value[k] = v;
                            } else {
                                delete value[k];
                            }
                        }
                    }
                }
                return reviver.call(holder, key, value);
            }


// Parsing happens in four stages. In the first stage, we replace certain
// Unicode characters with escape sequences. JavaScript handles many characters
// incorrectly, either silently deleting them, or treating them as line endings.

            cx.lastIndex = 0;
            if (cx.test(text)) {
                text = text.replace(cx, function (a) {
                    return '\\u' +
                        ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                });
            }

// In the second stage, we run the text against regular expressions that look
// for non-JSON patterns. We are especially concerned with '()' and 'new'
// because they can cause invocation, and '=' because it can cause mutation.
// But just to be safe, we want to reject all unexpected forms.

// We split the second stage into 4 regexp operations in order to work around
// crippling inefficiencies in IE's and Safari's regexp engines. First we
// replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
// replace all simple value tokens with ']' characters. Third, we delete all
// open brackets that follow a colon or comma or that begin the text. Finally,
// we look to see that the remaining characters are only whitespace or ']' or
// ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.

            if (/^[\],:{}\s]*$/.
test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@').
replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

// In the third stage we use the eval function to compile the text into a
// JavaScript structure. The '{' operator is subject to a syntactic ambiguity
// in JavaScript: it can begin a block or an object literal. We wrap the text
// in parens to eliminate the ambiguity.

                j = eval('(' + text + ')');

// In the optional fourth stage, we recursively walk the new structure, passing
// each name/value pair to a reviver function for possible transformation.

                return typeof reviver === 'function' ?
                    walk({'': j}, '') : j;
            }

// If the text is not JSON parseable, then a SyntaxError is thrown.

            throw new SyntaxError('JSON.parse');
        };
    }
}());
}
