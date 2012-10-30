/*
 * MelonJS Game Engine
 * Copyright (C) 2012, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

	/**
	 * debug stuff.
	 * @namespace
	 */
	me.debug = {
		
		/**
		 * enable the FPS counter <br>
		 * default value : false
		 * @type {Boolean}
		 * @memberOf me.debug
		 */
		displayFPS : false,

		/**
		 * render object Rectangle & Collision Box<br>
		 * default value : false
		 * @type {Boolean}
		 * @memberOf me.debug
		 */
		renderHitBox : false,

		/**
		 * render Collision Map layer<br>
		 * default value : false
		 * @type {Boolean}
		 * @memberOf me.debug
		 */
		renderCollisionMap : false,

		/**
		 * render dirty region/rectangle<br>
		 * default value : false<br>
		 * (feature must be enabled through the me.sys.dirtyRegion flag)
		 * @type {Boolean}
		 * @memberOf me.debug
		 */
		renderDirty : false,
		
		/**
		 * render entities current velocity<br>
		 * default value : false<br>
		 * @type {Boolean}
		 * @memberOf me.debug
		 */
		renderVelocity : false,
		
		/**
		 * show the debug Panel <br>
		 * Heap Memory information is available using Chrome when using the "--enable-memory-info" parameter<br>
		 * @public
		 * @function
		 */
		showPanel : function () {
			var panel = me.game.getEntityByName("me.debugPanel")[0];
			// create a new one if required
			if (!panel) {
				var panel = new me.debug.Panel();
				me.game.add(panel);
				me.game.sort();
			} else {
				panel.show();
			}
			// make sure at least the FPS 
			// counter is enabled
			me.debug.displayFPS = true;
		}
	};


	/**
	 * @class
	 * @protected
	 * @extends me.Rect
	 * @memberOf me
	 * @constructor
	 */
	me.debug.Panel = me.Rect.extend(
	/** @scope me.debug.Panel.prototype */
	{

	   // Object "Game Unique Identifier"
		GUID : null,

		// to hold the debug options 
		// clickable rect area
		area : {},

		// for z ordering
		// make it ridiculously high
		z : Infinity,
		
		// visibility flag
		visible : false,

		/** @private */
		init : function() {
			// call the parent constructor
			this.parent(new me.Vector2d(0, 0), me.video.getWidth(), 35);

			// set the object GUID value
			this.GUID = me.utils.createGUID();

			// set the object entity name
			this.name = "me.debugPanel";

			// peristent
			this.isPersistent = true;
			// a floating object
			this.floating = true;
			
			// create a default font, with fixed char width
			this.font = new me.Font('courier', 10, 'white');
			
			// clickable areas
			this.area.renderHitBox = new me.Rect(new me.Vector2d(160,5),15,15);
			this.area.renderVelocity = new me.Rect(new me.Vector2d(165,25),15,15);
			
			this.area.renderDirty = new me.Rect(new me.Vector2d(270,5),15,15);
			this.area.renderCollisionMap = new me.Rect(new me.Vector2d(270,25),15,15);
			
			// some internal string/length
			this.help_str	  = "(s)how/(h)ide";
			this.help_str_len = this.font.measureText(me.video.getScreenFrameBuffer(), this.help_str).width;
			this.fps_str_len = this.font.measureText(me.video.getScreenFrameBuffer(), "00/00 fps").width;

			this.drawStart = 0;
			
			// bind the "S" and "H" keys
			me.input.bindKey(me.input.KEY.S, "show");
			me.input.bindKey(me.input.KEY.H, "hide");
			
			// memory heap sample points
			this.samples = [];

			// make it visible
			this.show();
		},
		
		/** @private */
		show : function() {
			if (!this.visible) {
				this.pos.y = 0;
				// register a mouse event for the checkboxes
				me.input.registerMouseEvent('mousedown', this, this.onClick.bind(this));
				// make it visible
				this.visible = true;
				// force repaint
				me.game.repaint();
			}
		},
	
		/** @private */
		hide : function() {
			if (this.visible) {
				// hide it outside of the visible area
				this.pos.y = -this.height;
				// release the mouse event for the checkboxes
				me.input.releaseMouseEvent('mousedown', this);
				// make it visible
				this.visible = false;
				// force repaint
				me.game.repaint();
			}
		},
	
	
		/** @private */
		update : function() {
			
			if (me.input.isKeyPressed('show'))
			{
				this.show();
			}
			else if (me.input.isKeyPressed('hide'))
			{
				this.hide();
			}

			// update draw time
			// this should be the last object updated by the game manager
			this.drawStart = Date.now();

			return true;
		},
		
		/** @private */
		onClick : function()  {
			// check the clickable areas
			if (this.area.renderHitBox.containsPoint(me.input.mouse.pos)) {
				me.debug.renderHitBox = !me.debug.renderHitBox;
			} else if (this.area.renderDirty.containsPoint(me.input.mouse.pos)) {
				me.debug.renderDirty = !me.debug.renderDirty;
			} else if (this.area.renderCollisionMap.containsPoint(me.input.mouse.pos)) {
				me.debug.renderCollisionMap = !me.debug.renderCollisionMap;
				/*
					// not working with dynamic rendering since
					// collision layer does not have allocated renderers
					var layer = me.game.currentLevel.getLayerByName("collision");
					if (layer && me.debug.renderCollisionMap === false) {
						layer.visible = true;
						me.game.add(layer);
						me.debug.renderCollisionMap = true;
						me.game.sort();
					} else if (layer) {
						layer.visible = false;
						me.game.remove(layer);
						me.debug.renderCollisionMap = false;
					}
				*/	
			} else if (this.area.renderVelocity.containsPoint(me.input.mouse.pos)) {
				// does nothing for now, since velocity is
				// rendered together with hitboxes (is a global debug flag required?)
				me.debug.renderVelocity = !me.debug.renderVelocity;
			}
			// force repaint
			me.game.repaint();
		}, 
		
		/** @private */
		drawMemoryGraph : function (context, startX, endX) {
			if (window.performance && window.performance.memory) {
				var usedHeap  = Number.prototype.round(window.performance.memory.usedJSHeapSize/1048576, 2);
				var totalHeap =  Number.prototype.round(window.performance.memory.totalJSHeapSize/1048576, 2);
				
				var len = endX - startX;
				
				// remove the first item
				this.samples.shift();
				// add a new sample (25 is the height of the graph)
				this.samples[len] = (usedHeap / totalHeap)  * 25;
				
				// draw rhe graph
				for (var x = len;x--;) {
					var where = endX - (len - x);
					context.beginPath();		
					context.strokeStyle = "lightgreen";			
					context.moveTo(where, 30);
					context.lineTo(where, 30 - (this.samples[x] || 0));
					context.stroke();
				}
				// display the current value
				this.font.draw(context, usedHeap + '/' + totalHeap + ' MB', startX, 5);
			} else {
				// Heap Memory information not available
				this.font.draw(context, "??/?? MB", startX, 5);
			}
		},

		/** @private */
		draw : function(context) {
			var drawTime = Date.now() - this.drawStart;
			
			context.save();
			
			// draw the panel
			context.globalAlpha = 0.5;
			context.fillStyle = "black";
			context.fillRect(this.left,  this.top, 
							 this.width, this.height);
		    
			context.globalAlpha = 1.0;

			// # entities / draw
			this.font.draw(context, "#objects : " + me.game.getObjectCount(), 5, 5);
			this.font.draw(context, "#draws   : " + me.game.getDrawCount(), 5, 20);
			
			// debug checkboxes
			this.font.draw(context, "?hitbox   ["+ (me.debug.renderHitBox?"x":" ") +"]", 	100, 5);
			this.font.draw(context, "?velocity ["+ (me.debug.renderVelocity?"x":" ") +"]", 	100, 20);
			
			this.font.draw(context, "?dirtyRect  ["+ (me.debug.renderDirty?"x":" ") +"]", 		200, 5);
			this.font.draw(context, "?col. layer ["+ (me.debug.renderCollisionMap?"x":" ") +"]", 200, 20);

			// draw the memory heap usage 
			this.drawMemoryGraph(context, 300, this.width - this.help_str_len - 15);
			
			// some help string
			this.font.draw(context, this.help_str, this.width - this.help_str_len - 5, 20);
			
			//fps counter
			var fps_str = "" + me.timer.fps + "/"	+ me.sys.fps + " fps";
			this.font.draw(context, fps_str, this.width - this.fps_str_len - 5, 5);

			//draw time
			this.font.draw(context, "draw time : " + drawTime, 300, 5);
			
			context.restore();

		},
		
		/** @private */
		onDestroyEvent : function() {
			// hide the panel
			this.hide();
			// unbind "S" & "H"
			me.input.unbindKey(me.input.KEY.S);
			me.input.unbindKey(me.input.KEY.H);
		}


	});

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
