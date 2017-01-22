/*
 * TODO
 * Size checks!
 * Stop sync timer if notneeded (niah)
*/
//delete (localStorage['data']);
//var lala = chrome.bookmarks.getTree(function() {
//	console.log(arguments);
//});
// //console.log(lala);

Ext = {
	bookmark	: {},
	data		: {},

	inPopup		: location.href.indexOf('popup.html') !== -1,

	debugOn		: false,

	sizes		: {
		'xs': ['Extra Small', 25, 5],
		's'	: ['Small', 30,10],
		'm'	: ['Medium', 40, 15],
		'l'	: ['Large', 50, 20],
		'XL': ['Extra Large', 65, 30]
	},


	initialize : function() {

        this.load();

        if(this.inPopup) {
			var size 		= this.sizes[this.data.options.size || 'm'];
			var fontSize 	= this.data.options.fontSize || 13;
			this.area  		= document.createElement('textarea');
			document.body.insertBefore(this.area, document.body.firstChild);

			this.area.name  = '"Chrome Notepad: A simple notes app for Chrome';
			this.area.placeholder = ''
			this.area.style.width = size[1] + 'em';
			this.area.style.height = size[2] + 'em';

			this.area.style.fontSize = fontSize + 'px';

			this.area 		= document.getElementsByTagName('TEXTAREA')[0];
			this.area.value = this.data.content || '';

			// NOT FOR NOW
			if(0 && this.data.size) {
				this.area.style.height  = this.data.size.height + 'px';
				this.area.style.width  = this.data.size.width + 'px';
			}

			this.area.addEventListener('keyup', function(event) {
				Ext.save(Ext.area.value);
				Ext.getSelection();

			}, false);

			this.area.addEventListener('mouseup', function(event) {
				Ext.getSelection(true);
			});

			this.area.focus();

			// Restore selection and scroll
			if(this.data.selection || this.data.scroll) {

                var self = this;

                setTimeout(function () {
                    if (self.data.selection) {
				        self.area.setSelectionRange(self.data.selection.start, self.data.selection.end)
                    }
                    if (self.data.scroll) {
                        self.area.scrollLeft        = self.data.scroll.left;
                        self.area.scrollTop         = self.data.scroll.top;
                    }
                }, 100);
			}


			this.reportUpdate();

			this.reportSync();


			chrome.extension.onRequest.addListener(function(req, sender, sendResponse) {

				if(req.action) {
					switch(req.action) {
						case 'reloadContent':
							// Timeout is needed for this dev version :)
							setTimeout(function() {
								Ext.load();
								Ext.area = window.document.getElementsByTagName('TEXTAREA')[0];
								if(Ext.area) {
									Ext.area.value = Ext.data.content;
									if(Ext.data.selection) {
										Ext.area.setSelectionRange(Ext.data.selection.start, Ext.data.selection.end);
									}

									if(Ext.data.scroll) {
										Ext.area.scrollLeft	 	= Ext.data.scroll.left;
										Ext.area.scrollTop		= Ext.data.scroll.top;
									}

								}

								Ext.reportUpdate();
							}, 100);
							break;
					}
				}

			});


		} else {
			// Background

			this.sync = new BSync({
				getUpdate	: function() {
					Ext.load();
					return Ext.data.updated;
				},

				onRead		: function(json, bookmark) {
					Ext.load();
					// Only on reads
					Ext.data.synced		= Ext.data.updated = this.syncedAt;

					Ext.data.content	= json.content;
					Ext.data.updated	= json.updated;
					Ext.data.selection	= json.selection;
					Ext.data.scroll		= json.scroll;

					Ext.debug( 'LOADED DATA IS: ');
					Ext.debug(Ext.data);
					Ext.save();

					Ext.sendRequest({
						'action'	: 'reloadContent'
					});
				},

				onWrite		: function() {
					// We can add some tests here (before writing)
					// If we want to :)
					Ext.load();
					this.write({
						'content'	: (Ext.data['content'] || '').slice(0, 2000), // Max 2k
						'updated'	: Ext.data.updated,
						'selection'	: Ext.data.selection,
						'scroll'	: Ext.data.scroll
					});

					//console.log('writing ' + Ext.data['content'] );
				}
			});


			// // Start it or not.
			if(this.data.options && this.data.options.sync || this.data.options.sync === undefined) {
			 	this.sync.start();
			}

		}


		return this;
	},


	getDT						: function(timestamp) {

		var string = 'N/A';
		var days, hours, minutes, seconds, diff;

		if(timestamp) {
            diff = Math.round( (new Date().getTime() - timestamp) / 1000 ),
            hours = Math.round(diff/3600);

			if( diff == 0) {
				string = 'Just now'
			} else if( diff  < 60  ) {
				string = diff+ ' second' + (diff > 1 ? 's' : '') + ' ago'
			} else if (diff > 60 && diff < 3600) {
				minutes 	= Math.round(diff/60);
				seconds 	= diff % 60;
				string	 	= Math.round(diff / 60) + ' minute'+(Math.round(diff / 60) > 1 ? 's' : '')+' ago';
			} else if (diff > 3600 && hours < 48) {
				string 		= hours + ' hour'  + (hours > 1 ? 's' : '') + ' ago';
			} else {
				string 		= 'Long time ago'
			}
		}

		return string;
	},


	reportSync					: function() {
		var sync = document.getElementById('sync');
		if(this.data.options.sync === undefined) {
			this.data.options.sync = true;
		}

		if(!this.data.options || !this.data.options.sync) {

			sync.innerHTML = 'Sync is off';
		} else {
			if(!this.data.options.sync)  {

				sync.innerHTML = 'Sync is off'
			} else {
				sync.innerHTML	= 'Synced: ' + this.getDT(this.data.synced);
			}
		}
		return this;
	},


	reportUpdate				: function() {
		// Handle update
		var updated 	= document.getElementById('updated');
		if(!updated || !this.data.updated) {
			return false;
		}



		updated.innerHTML = 'Updated: ' + this.getDT(this.data.updated);

	},

	getSelection				: function(getSize) {
		this.data.selection = {
			'start'	: this.area.selectionStart,
			'end'	: this.area.selectionEnd
		}

		this.data.scroll	= {
			'left'	: this.area.scrollLeft,
			'top'	: this.area.scrollTop
		}



		// NOT FOR NOW
		if(0)
		if(getSize) {
			this.data.size = {
				'width'		: this.area.clientWidth - 2,
				'height' 	: this.area.clientHeight - 2
			}
		}


		Ext.save();
	},



	sendRequest	: function(obj) {
		chrome.extension.sendRequest(obj);
		return this;
	},

	debug		: function(arg) {
		if(!this.debugOn)	 {
			return this;
		}

	},

	load		: function() {
		if(localStorage['data']) {
			try {
				this.data 			= JSON.parse(localStorage['data'])
			} catch(ex) {
				this.data			 = null;
			}
		}

		// Initialize this.data
		if(!this.data) {
			this.data = {
				'content'	: '',

				'selection' : {
					'start'	: 0,
					'end'	: 9
				},

				'scroll'	: {
					'left'	: 0,
					'top'	: 0
				},

				'size'		: {
					'width'	: 100,
					'height': 80
				},
				'options'	: {
					'sync'	: false
				}
			}
		}

		if(!this.data.options) {
			this.data.options = {
				'sync' : true
			}
		}



		return this;
	},

	save		: function(content) {
		if(content !== undefined && content !== this.data['content']) {
			this.data['content'] 	= content;
			Ext.data.updated 		= new Date().getTime();
		}
		localStorage['data'] 	= JSON.stringify(this.data);
		return this;
	}

}


if (Ext.inPopup) {
    Ext.initialize();
}