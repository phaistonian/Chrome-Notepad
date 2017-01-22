// v.32
Extensions = {
    getExtension : function(callback) {
        var url = 'manifest.json';
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.send();

        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4 ) {
                callback && callback(JSON.parse(xhr.responseText));
            }
        };
    }
}






/*
* Check out BSync section for tips on Evernote's related file.
*/
BSync = function(options) {
    this.initialize(options);
    return this;
};
BSync.prototype = {
    'options'   : {
        'debug'             : false,

        'interval'          : 20 * 1000,                  // 20 secs +
        //'interval'          : (350 +  Math.floor(Math.random() * 25) ) * 1000,                  // 5 mins +
        'newLine'           : '\n',                                                             // char code to replace
        'idleInterval'      : 200 * 1000,
        'name'              : null,                                                             // Auto fills with the extension's name
        'deleteOther'       : true,                                                             // Delete ones with the same name
        'parent'            : null,                                                             // Auto fills with the other.bookmarks

        'testNetwork'       : false,                                                            // MAKE SURE google.com is on premissions list
        'networkTimeout'    : 3000,                                                             // 3 secs

        'folder'            : 'BSync',                                                          // Must have

        // Error handler
        'onError'       : function(msg) {
            //TODO: Handle msg
            console.log('BSYNC ERROR : ' + msg);
            this.options && this.options.debug && console.log('ERROR: ' + msg)
        }
    },

    'initialize' : function(options) {

        var self = this;

        this.setOptions(options);

        if(this.options.debug) {
            //this.options.interval         = 10 * 1000;
            //this.options.idleInterval     = 5 * 1000;
        }

        // Get parent options.parent >> the latest folder in 0 level
        if(!this.options.parent) {
            chrome.bookmarks.getChildren('0', function(tree) {
                tree.forEach(function(item, index) {
                    self.options.parent = item.id;
                });
            });
        }

        return this;
    },

    attach      : function() {

        var self = this;

        if(this.isAttached) {
            return this;
        }

        // Get the name and come back
        if (!this.options.name) {

            Extensions.getExtension(function(json) {
                self.options.name = json.name;
                self.attach();
            });

            return this;
        }
        this.isAttached = true;

        // No name, no game
        if(!this.options.name || !this.options.folder) {
            throw('No name (name or folder) given, bailing out');
            return;
        }

        // Must not be less < 2 mins
        if(!this.options.debug && parseInt(this.options.interval) < 120 * 1000) {
            this.options.interval = 120 * 1000;
        }

        // First traverse = wait 10 secs.
        // TODO: Figure out a way to make this better.
        setTimeout((function() {
            self.traverse();
        }), 4000);

        // Global bookmark event handler
        chrome.bookmarks.onCreated.addListener(function(id, bookmark) {

            var ts;

            if (bookmark.url && self.folder && self.folder.id == bookmark.parentId && (ts = self.isValidBookmark(bookmark) )) {
                (function() {
                    // Checkin on timestamps is safer - it seems
                    // since self.bookmark is defined later on.
                    if(self.bookmark && (parseInt(self.syncedAt) != parseInt(ts) ) && (self.bookmark.id !== bookmark.id)    ) {
                        // Stop timers
                        self.stop();
                        self.options.debug && console.log('REMOVING AND PROCEESSING ON CREATED');

                        // Assign the syncedAt to the bookmark.
                        // Will be needed later when processing (if it shouldRead() )
                        // NOTE: useless since isValidBookmark does that already
                        bookmark.syncedAt = ts;

                        self.process(bookmark, true);

                        // Start timers
                        self.start();
                    } else  {
                        return false;
                    }
                }).delay(800, this);
            }

        });

        // Used to check for folder removal (sanity)
        chrome.bookmarks.onRemoved.addListener(function(id, bookmark) {
            self.options.debug && bookmark.url == undefined && console.log('onRemoved self.folder.id:' + self.folder.id +', id: ' + id + ' title:' + bookmark.title);

            // In case the folder is the same as self.folder then nullify
            // the folder in order to re-get it.
            if(self.folder && (id == self.folder.id) ) {
                self.folder = null;
            }
        });

        return this;
    },

    testNetwork : function() {

        var xhr      = new XMLHttpRequest(), self = this;
        var timer    = setTimeout( function() {
            self.error('NO_NETWORK')
            return this;
        }, this.options.networkTimeout);

        xhr.open('GET', 'http://www.google.com/favicon.ico', true);
        xhr.send();

        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4 ) {s
                clearTimeout(timer);
                timer = null;

                // Proper response = traverse
                if(xhr.responseText.length > 100 ) {
                    self.traverse(true);
                }
            }
        };

        return this;
    },

    getFolder   : function() {
        var self = this;
        if (this.folder) {
            return this.folder;
        };

        var folder, toMove = [], toDelete = [];

        // Find the folder
        chrome.bookmarks.getChildren(this.options.parent.toString(), function(tree) {

            var ts = 0;

            tree.forEach(function(item, index) {

                // Move previous items to the folder;
                if( item.title.match( new RegExp('^.+?\\\.' + '([0-9]{10,}?)$'))) {
                    toMove.push(item);
                }

                if(item.title === self.options.folder && item.url === undefined) {
                    // Keep the one with the hightest dateAdded
                    if(item.dateAdded > ts) {
                        folder  = item;
                        ts      = item.dateAdded;
                    }
                    toDelete.push(item);
                    return this;
                }
            });

            if (!folder) {
                folder = chrome.bookmarks.create({
                    'parentId'  : self.options.parent.toString(), // other
                    'title'     : self.options.folder
                });
            } else {
                // Remove unwanted (more than one) folders with the same name.
                toDelete.forEach(function(f, index) {
                    if(f.id !== folder.id) {
                        chrome.bookmarks.removeTree(f.id);
                    }
                });
            }

            // Move OLD way items to folder
            if(folder && toMove) {
                toMove.forEach(function(item, index) {
                    chrome.bookmarks.move(item.id, {
                        'parentId' : folder.id.toString()
                    });
                });
            }

            self.folder  = folder;

            // Traverse again
            self.traverse(true);
        });

        return false;
    },

    traverse        : function(skipTest) {
        var self    = this, toDelete = [], bookmark, content, folder = this.folder, match;

        // Make sure !this.folder is present below
        if(!skipTest && this.options.testNetwork && !this.folder) {
            return this.testNetwork();
        }

        if( this.lastTraversed) {
            this.options.debug && console.log( 'TRAVERSED DIFF : ' + ((new Date().getTime() - this.lastTraversed ) / 1000 ) );
            this.lastTraversed = new Date().getTime();
        } else {
            this.lastTraversed = new Date().getTime();
        }


        // If the update is less than 1 minute < wait for it to be idle then come back
        // THIS IS HUGE TIME SAVER (avoids multiple stuff)
        // NOTE: First time is a go (this.syncedAt is undefiend )
        if(this.options.getUpdate && this.options.getUpdate() && this.syncedAt) {
            if( (new Date().getTime() - this.options.getUpdate() )  < this.options.idleInterval ) {
                console.log('WAITING FOR '+this.idleInterval+'  TO GET UN-IDLE')

                // Not idle  // Wait for twice the idleInterval
                setTimeout( (function() {
                    self.traverse();
                }), this.options.idleInterval * 2);

                return this;
            }
        }

        // No folder yet - go fetch one
        if (!folder) {
            return this.getFolder();
        }

        chrome.bookmarks.getChildren(folder.id.toString(), function(tree) {

            var syncedAt = 0, ts;
            tree.forEach(function(item, index) {

                // valid bookmark
                if (ts = self.isValidBookmark(item)) {
                    if (self.options.deleteOther) {
                        toDelete.push(item);
                    }

                    // Make sure this bookmark is a bit valid.
                    // We want the one with the latest syncedAt value and one with a void.
                    if (item.url.indexOf('void') != -1 && ( ts > syncedAt )) {
                        bookmark            = item;

                        // NOTE: This is useless (too) sinc isValidBookmark does it already.
                        bookmark.syncedAt   = ts; // timestamp
                        syncedAt            = ts;
                    }
                }

            });

            // No bookmark founds
            if(!bookmark) {
                self.options.debug && console.log('NO BOOKMARK FOUND  > WRITING');
                self.options.onWrite();
                return self.options.onError('MISSING BOOKMARK');
            }

            // Delete other bookmarks:
            // Prolly left here by quota issues.
            if (self.options.deleteOther) {
                toDelete.forEach(function(b, i) {
                    if(String(b.id) != String(bookmark.id)) {
                        try {
                            chrome.bookmarks.remove(String(b.id));
                        } catch(ex) {}
                    }
                });
            }

            // Register this.previousSync for first timec
            self.synced = bookmark.syncedAt;

            // TODO: Is this really needed here?
            self.bookmark = self.bookmark || bookmark;

            return self.process(bookmark);

        });

        // Re-roll
        return this.start();
    },

    // Process the actual bookmark and do what's needed  + cast events
    // forceRead means that the function is called durin a onCreated event
    process: function (bookmark, forceRead) {
        var content, self = this;

        // Get the content
        if (!(content = this.getJSON(bookmark) ) ) {
            self.options.debug && console.log(' NO CONTENT FOUND > WRITING' );
            this.options.onWrite()
            return this.options.onError('NO CONTENT');
        }

        // Assign data to self
        this.content        = content;

        // Must
        var syncedPrevious  = this.syncedAt;

        this.syncedAt       = bookmark.syncedAt;

        if (!forceRead && this.shouldWrite()) {
            self.options.debug &&  console.log('\nAbout to write');
            this.options.onWrite(content, bookmark);
        }  else if(this.shouldRead() ) {
            self.options.debug &&  console.log('\nAbout to read');
            this.syncedAtPrevious   = this.syncedAt;
            this.markTimestamp();
            this.bookmark           = bookmark;
            this.options.onRead(content, bookmark);
        } else {
            self.options.debug &&  console.log(' NOTHING TO DO :) ');
        }




        return this;
    },

    shouldRead  : function() {

        // NOTE: if we dont have a syncedPrevious and options.getupdate, try a time in past
        if (this.options.debug) {
            console.log('\n\nChecking shouldRead()');
            console.log('this.syncedAtPrevious: ' + this.syncedAtPrevious);
            console.log('this.syncedAt: ' + this.syncedAt);
            console.log('his.options.getUpdate(): ' + this.options.getUpdate());
        }

        return this.options.getUpdate() === undefined || ( this.content && this.syncedAt > this.options.getUpdate());
    },

    shouldWrite : function() {

        if(this.options.debug) {
            console.log('\n\nChecking shouldWrite()');
            console.log('this.syncedAtPrevious: ' + this.syncedAtPrevious);
            console.log('this.syncedAt: ' + this.syncedAt);
            console.log('his.options.getUpdate(); ' + this.options.getUpdate());
        }

        return !this.content || ( this.options.getUpdate() && (  this.options.getUpdate() > this.syncedAt  ));
    },

    // Please be aware that content size can not exceed 2.2k
    write: function (json) {

        var self = this;

        // Same content / Error / bail out
        // http://groups.google.com/group/chromium-extensions/msg/e6fc1923ba706f11
        if (this.content) {
            if (JSON.stringify(this.content) === JSON.stringify(json)) {
                self.options.debug && console.log('SORRY SAME CONTENT / BAILING OUT');
                return false;
            }
        }

        // TODO: In the future, we could just update this.
        // WAIT FOR 1 (+1 sec) min before - to avoid throttling
        if(this.bookmark && this.bookmark.id) {
            try { chrome.bookmarks.remove(String(this.bookmark.id)); } catch(ex) { }
        }

        this.syncedAtPrevious   = this.syncedAt;

        // THIS IS THE KEY!
        this.syncedAt = this.options.getUpdate() || new Date().getTime();

        // TODO: Do it recursively, not just for the first level
        // Fixes the new line issue for the url
        var fixNL = function (obj) {

            each(obj, function(value, key) {

                if(value && value.toLowerCase && value.toLowerCase()) {
                    obj[key] == value.replace( new RegExp('('+ String.fromCharCode(10) + '|' + String.fromCharCode(13) +')' , 'g'),self.options.newLine);
                }
            });

            return obj;
        }

        json = fixNL(json);

        // Make the bookmark, and assign it to self
        chrome.bookmarks.create({
            'parentId'  : this.folder.id.toString(), // other
            'title'     : this.options.name + '.' + this.syncedAt, // append the timestamp / 1000 (unixtimestamp)
            'url'       : 'javascript:void(\''+ JSON.stringify(json) + '\');void('+(Math.random() * 1000)+');'
            },
            function(bookmark) {
                self.bookmark = bookmark;
            }
        );

        self.options.debug && console.log('\nWROTE > ' + JSON.stringify(json) )

        this.markTimestamp(true);

        return this;
    },

    start       : function() {
        if (!this.isAttached) {
            return this.attach();
        }

        var self        = this;

        this.timer      = setTimeout(function() { self.traverse(); }, this.options.interval);
        this.isRunning  = true;

        return this;
    },

    stop        : function() {
        if (!this.isRunning) {
            return this;
        }

        clearTimeout(this.timer);
        this.timer = null;
        this.isRunning = false;

        return this;
    },

    setOptions      : function(options) {
        var self = this, fn, bound;

        for (var i in options) {
            if (typeof(options[i]) == 'function') {
                this.options[i] = options[i].bind(this);
            } else {
                this.options[i] = options[i];
            }
        }

        return this;
    },

    // Register timestamps
    markTimestamp: function (mode) {
        this['synced' + (mode ? 'To' : 'From')] = new Date().getTime();
        return this;
    },

    // Parses a bookmark's.url content as JSON
    getJSON: function (bookmark) {
        var source = bookmark.url, content, json = '';

        source = source.replace(/^.*?void\('(.*?)'\);void.*?$/, '$1');
        source = source.replace( new RegExp( this.options.newLine, 'g'), String.fromCharCode(10));

        if (source) {
            try {
                json = JSON.parse(source);
            } catch(ex) {
                json = '';
            }
        }

        return json;
    },

    // Makes sure a bookmark is valid and returs its timestamp if so
    isValidBookmark: function (bookmark) {

        var match;

        if(!bookmark) {
            return false;
        }

        if (!(match = bookmark.title.match(new RegExp('^'+ this.options.name + '\\\.' + '([0-9]{10,}?)$')))) {
            return false;
        }

        // VERY CRITICAL
        bookmark.syncedAt = match[1];

        return parseInt(match[1]);
    }
}















Tooltip = new Class({
    'options'       : {
        'timeouts'          : {
            'open'          : 300,
            'close'         : 50
        },
        'dontCloseOnElement'    : false,
        'removeTitle'           : true,
        'onOpen'                : function() {
            this.source.addClass('tooltip-source-open');
        },
        'onClose'               : function() {
            this.source.removeClass('tooltip-source-open');
        }
    },

    'initialize'    : function(source, content, options) {
        var self    = this;
        this.source = source;

        this.setOptions(options);

        // Create the element
        this.element                    = document.createElement('div');
        this.element.style.cssText      = 'position: absolute; top: -10000px; left: -10000px;';
        this.element.className          = 'tooltip';

        // The events
        this.source.addEventListener('mouseover', function(event) {
            event.stopPropagation();
            self.open();
        }, false);

        this.source.addEventListener('mouseout', function(event) {
            event.stopPropagation();
            if(event.relatedTarget !== self.element) {
                self.close();
            }
        }, false);

        this.element.addEventListener('mouseover', function(event) {
            event.stopPropagation();
            if(self.options.dontCloseOnElement) {
                self.open();
            }
        }, false);

        this.element.addEventListener('mouseout', function(event) {
            event.stopPropagation();
            if(event.relatedTarget !== self.source) {
                self.close();
            }
        }, false);


        this.setContent(content);

        // We need this;
        this.source.tooltip = this;

        // Append to body
        document.body.appendChild(this.element);

        if(this.options.removeTitle) {
            this.source.removeAttribute('title');
        }

        return this;
    },

    updateFromTitle : function() {
        this.setContent(this.source.title);
        if(this.options.removeTitle) {
            this.source.title = '';
        }

        return this;
    },

    'setContent'    : function(content) {
        if(!content) {
            return this;
        }

        if(typeof content === 'string') {
            this.element.innerHTML = content;
        } else {
            this.element.appendChild(content);
        }

        this.content = content;

        return this;
    },


    open    : function() {
        if(!this.content) {
            return false;
        }
        if(this.timerClose) {
            this.timerClose = $clear(this.timerClose);
        }

        if(!this.timerOpen) {
            this.timerOpen = this.open.delay(this.options.timeouts.open, this);
            return;
        }

        if(this.isOpen)      {
            return this;
        }

        if(Tooltip.current && Tooltip.current != this ) {
            Tooltip.current.close();
        }

        // TODO: fade it too
        this.isOpen = true;
        this.element.addClass('tooltip-open');

        this.pos();
        this.invokeEvent('open');

        Tooltip.current = this;
        return this;
    },


    close   : function() {

        if(this.timerOpen) {
            this.timerOpen = $clear(this.timerOpen);
        }

        if(this.isOpen === false) {
            return this;
        }

        if(!this.timerClose) {
            this.timerClose = this.close.delay(this.options.timeouts.close, this);
            return;
        } else {
            // First trigger via event
            if(event && event.type  ) {
                return this;
            }
        }


        this.isOpen = false;

        this.element.removeClass('tooltip-open');

        // this.element.style.opacity = 0;
        // BASED ON webkit-trasnition
        // TODO: FIX THIS ON USERID TOO
        (function() {
            //this.element.style.display = 'none';
            this.element.style.left = -1000 + 'px';
            this.element.style.top =  -1000 + 'px';
            this.element.style.opacity = 0;

            this.invokeEvent('close');
        }).delay(150, this);

        Tooltip.current = null;

        return this;

        this.element.style.display = 'none';

    },

    pos     : function() {

        var elem            = this.source;
        if(!elem.getBoundingClientRect) {
            return this;
        }
        var window_height   = window.innerHeight - (document.body.offsetWidth > window.innerWidth ? 20 : 0);
        var window_width    = window.innerWidth - (document.body.offsetHeight > window.innerHeight ? 20 : 0);

        // Nasty way to figure out position
        var pos     = elem.getBoundingClientRect(), left, top;
        var sLeft   = Math.max(document.documentElement.scrollLeft, document.body.scrollLeft);
        var sTop    = Math.max(document.documentElement.scrollTop,  document.body.scrollTop);

        left        = pos.left  +  sLeft;
        top         = pos.top   +  sTop;

        var goodLeft = left;
        var goodTop = top;

        left        -= document.documentElement.clientLeft;
        top         -= document.documentElement.clientTop;

        // middle
        left        += elem.offsetWidth + 10;
        top         += elem.offsetHeight;

        //left      -= this.element.offsetWidth;

        if(left + this.element.offsetWidth > window_width + sLeft) {
            left = window_width - this.element.offsetWidth + sLeft;
        }

        if(top + this.element.offsetHeight > window_height + sTop) {
            top = window_height - this.element.offsetHeight + sTop;
        }

        // Shadow thing
        top -= 4;

        // last checks
        if(top < goodTop + 11) {
            top = goodTop - this.element.offsetHeight;
        }

        // For just one case
        if(top < 0) {
            top  = 0;
            left = goodLeft - this.element.offsetWidth;
        }

        this.element.style.top  = top  + 'px';
        this.element.style.left = left + 'px';

        //console.log(document.body.scrollHeight > document.body.clientHeight);
        //console.log(window.innerWidth, document.documentElement.scrollWidth)      //console.log(window.innerHeight, document.body.clientHeight, d ocument.body.offsetHeight)
        return this;

    }
}).implement(new Options, new Events);











































Graph = new Class({
    options     : {
        'key'   : 'value',

        'min'   : null,
        'max'   : null,

        'fill'  : false,
        'stroke': true,

        'ctx'   : {
            'strokeStyle'   : 'green',
            'fillStyle'     : 'white'
        }
    },

    initialize : function(series, container, options) {
        this.setOptions(options);
        alert
        this.container  = $(container);
        this.container.innerHTML = '';

        if(!this.container.style.position.match(/(relative|absolute)/) ) {
            this.container.style.position = 'relative';
        }
        this.series     = series ? series : [];

        return this;
    },

    setSeries       : function(data) {
        this.series = data;
        return this.draw();

    },

    setTicks        : function(ticks)  {
        this.options.ticks = ticks;
    },

    addSeries       : function(data) {
        this.series.push(data);
        return this.draw();
    },

    // Also gets total
    getMin      : function() {
        if(this.options.min) {
            return this.options.min;
        }
        var min     = null;

        var total   = 0;
        this.series.each(function(series, index) {
            if(series.data.length > total) {
                total = series.data.length;
            }

            series.data.each(function( item, index) {
                if(min === null || ( item < min) ) {
                    min = item
                    //minX = item[this.options.keyY];
                }
            }, this);
        }, this);

        this.total = total;

        this.min    = min;

        return this.min;
    },

    getMax      : function() {
        if(this.options.max) {
            return this.options.max;
        }

        var max = null;

        this.series.each(function(series, index) {
            series.data.each(function( item, index) {
                if(max === null || ( item > max) ) {
                    //maxY = item[this.options.keyX];
                    max = item;
                    //maxX = item[this.options.keyY];
                }
            }, this);
        }, this);

        this.max = max;

        return this.max;
    },

    getTotal    : function() {
        return this.total;
    },

    draw        : function() {
        this.size = this.size || {
            'width'     : this.container.clientWidth,
            'height'    : this.container.clientHeight
        };

        // Empty container;
        this.inner          = this.inner|| $C('div').injectIn(this.container);
        this.ticks          = this.ticks|| $C('div').injectIn(this.container);
        if(!this.ctx) {
            this.ticks.style.cssText    = 'position: absolute; left: 0; top: 0;';
            this.ticks.style.height     = this.size.height + 'px';
            this.ticks.style.width      = this.size.width + 'px';
        }

        this.inner.style.overflow       = 'hidden';
        this.inner.style.width          = this.size.width + 'px';
        this.inner.style.height         = this.size.height + 'px';

        this.inner.innerHTML            = this.ticks.innerHTML = '';

        this.canvas         = this.canvas || $C('canvas', {
            'width'     : this.size.width,
            'height'    : this.size.height
        }).injectIn(this.inner);


        this.ctx            = this.ctx  || this.canvas.getContext('2d');

        // Set some styles e.g strokeStyle, lineJoin, fillStyle
        // TODO: Do this just once
    //  for(var property in this.options['ctx']) {
    //      this.ctx[property] = this.options['ctx'][property];
        //}


        // Begin actual rendering
        this.ctx.clearRect(0, 0, this.size.width, this.size.height);

        // Draw series heres
        this.series.forEach(function(series, index) {
            this.drawSeries(series);
        }, this);


        // Render ticks
        this.renderTicks();

        return this;
    },

    // draw single graph based on series
    drawSeries  : function(series) {
        var data = series.data;
        var x, y, value, min = this.getMin(), max = this.getMax(), total = this.getTotal();
        //var options = data.options || options;

        // Set some styles e.g strokeStyle, lineJoin, fillStyle
        // TODO: Do this just once
        var options = series.ctx && series.ctx ? $merge(this.options.ctx, series.ctx) : this.options.ctx;


        for(var property in options) {
            this.ctx[property] = options[property];
        }


        // Begin actual rendering

        this.ctx.beginPath();

        for(var i = 0; i < total; i++ ) {
            value = data[i];
            x = ( this.size.width / (total -1) ) * i;
            y = !this.options.reverse ?
            ( this.size.height - ( ( value - min) / ( max - min)) *
            this.size.height ) :
            ( value - min) / ( max - min ) *    this.size.height;



            i === 0 && this.ctx.moveTo(x, y);
            this.ctx.lineTo(x, y);

        }

        // Fill the thing
        var fill = series.fill != undefined ? series.fill : this.options.fill;
        if(fill) {
            this.ctx.lineTo(this.size.width + 100, this.size.height + 10);
            this.ctx.lineTo(0, this.size.height + 50);
            this.ctx.fill();
        }

        var stroke = series.stroke !== undefined ? series.stroke : this.options.stroke;
        if(stroke) {
            this.ctx.stroke();
        }

        return this;

    },

    renderTicks : function() {
        var tick,
        // Y first
        tick = $C('div').setClass('graph-tick');
        tick.style.cssText = 'position: absolute; left: 0;'
        tick.setHTML(this.options.reverse ? this.min : this.max);
        this.ticks.appendChild(tick)
        tick.style.marginLeft =  -(tick.offsetWidth + 5) + 'px';
        tick.style.top =  0;


        tick = $C('div').setClass('graph-tick');
        tick.style.cssText = 'position: absolute; left: 0;'
        tick.setHTML(this.options.reverse ? this.max : this.min);
        this.ticks.appendChild(tick)
        tick.style.marginLeft =  -(tick.offsetWidth + 5) + 'px';
        tick.style.bottom   =  0;

        // then y
        tick = $C('div').setClass('graph-tick');
        tick.style.cssText = 'position: absolute; left: 0;'
        tick.setHTML(this.options.ticks[0]);
        this.ticks.appendChild(tick)
        tick.style.left =  0;
        tick.style.bottom =  -(tick.offsetHeight  + 5 ) + 'px';


        tick = $C('div').setClass('graph-tick');
        tick.style.cssText = 'position: absolute;;'
        tick.setHTML(this.options.ticks[this.total-1]);
        this.ticks.appendChild(tick)
        tick.style.right =  0;
        tick.style.bottom =  -(tick.offsetHeight  + 5 ) + 'px';


    }
}).implement(new Options, new Events);


Overlay = new Class({
    options     : {
        duration    : {
            'open'  : .15,
            'hide'  : .10,
        },

        append      :{
            before  : null,
            after   : null
        },

        esc         : true
    },

    initialize : function(options) {
        this.setOptions(options);
        var self                        = this;
        this.element                    = $C('div').setClass('overlay');
        this.element.style.cssText      = 'position: fixed; top: 50%; left: 50%;z-index: 9999999;opacity: 0;';

        document.body.appendChild(this.element);

        this.window                     = $C('div').addClass('overlay-window');
        this.window.style.cssText       = 'position: fixed; width: 100%; height: 100%; top: 0; left: 0; -index: 999999;';
        document.body.appendChild(this.window);

        // before, content, after
        this.elements   = {
            'before'    : $C('div').injectIn(this.element).addClass('overlay-before').injectIn(this.element),
            'content'   : $C('div').injectIn(this.element).addClass('overlay-content').injectIn(this.element),
            'after'     : $C('div').injectIn(this.element).addClass('overlay-after').injectIn(this.element)
        }

        window.addEventListener('keydown', function(event) {
            if(event.keyCode == 27 && self.options.esc) {
                self.close();
            }
        }, false);

        return this.hide();
    },

    open        : function(content) {
        content && this.setContent(content);

        this.isOpen = true;
        this.element.style.webkitTransition = 'opacity '+this.options.duration.open+'s linear';
        this.window.style.webkitTransition  = 'opacity '+this.options.duration.open+'s linear';
        this.element.addClass('overlay-open');
        this.window.addClass('overlay-window-open');

        this.pos();
        return this;
    },

    close       : function() {
        if(!this.isOpen){
            return this;
        }

        this.isOpen = false;

        this.element.style.webkitTransition = 'opacity '+this.options.duration.hide+'s linear';
        this.window.style.webkitTransition  = 'opacity '+this.options.duration.hide+'s linear';

        this.element.removeClass('overlay-open');
        this.window.removeClass('overlay-window-open');

        (function() {
            this.hide();
        }).delay(this.options.duration.hide * 1000, this);

        return this;
    },

    setContent  : function(content) {
        if(!content) {
            return this;
        }

        if(this.options.append.before) {
            if(this.options.append.before.toLowerCase) {
                this.elements.before.innerHTML = this.options.append.before;
            } else if(this.append.before.nodeName) {
                this.elements.before.innerHTML  = '';
                this.elements.before.appendChild(this.options.append.before);
            }
        }

        if(this.options.append.after) {
            if(this.options.append.after.toLowerCase) {
                this.elements.after.innerHTML = this.options.append.after;
            } else if(this.append.after.nodeName) {
                this.elements.after.innerHTML  = '';
                this.elements.after.appendChild(this.options.append.after);
            }
        }


        if(content.toLowerCase) {
            this.elements.content.innerHTML = content;
        } else if(content.nodeName) {
            this.elements.content.innerHTML = '';
            this.elements.content.appendChild(content);
        }

        return this.isOpen ? this.pos() : this;
    },

    hide        : function() {
        this.element.style.left = this.window.style.left = '-10000px';
        return this;
    },

    pos         : function() {
        this.element.style.left = this.element.style.top = '50%';
        this.window.style.left  = this.window.style.top     = '0';
        this.element.style.marginLeft   = - (this.element.offsetWidth / 2 ) + 'px';
        this.element.style.marginTop    = - (this.element.offsetHeight / 2 ) + 'px';

        return this;
    }
}).implement( new Options);