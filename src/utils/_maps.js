/**
 * @author:	Emmanuel SMITH <hey@emmanuel-smith.me>
 * project:	ets2-dashboard-skin
 * file: 	_maps.js
 * Date: 	18/12/2020
 * Time: 	21:38
 */

import _history from '@/utils/_history';
import axios    from 'axios';
import ol       from 'openlayers';
import Vue      from 'vue';
import store    from '../store/index';

let d = {
	map:                       null,
	playerIcon:                null,
	playerFeature:             null,
	gBehaviorCenterOnPlayer:   true,
	gBehaviorRotateWithPlayer: true,
	gIgnoreViewChangeEvents:   false,
	ready:                     false,
	arrowRotate:               '',
	config:                    null,
	paths:                     {
		base:   '',
		tiles:  'tiles/{z}/{x}/{y}.png',
		config: 'config.json'
	}
};

const ZOOM_MIN          = 0;
const ZOOM_MAX          = 9;
const ZOOM_DEFAULT      = 9;
const TILES_REMOTE_HOST = 'https://ets2.jagfx.fr';

// ----

/**
 * TODO: Add verification for the min map version and the min map version allowed by the dash
 * FIXME: Correct the CORS not allowed with the remote tile location
 */

const initConfig = ( game ) => {
	const type          = store.getters[ 'config/get' ]( 'maps_map_activeMap' );
	const tilesLocation = store.getters[ 'config/get' ]( 'maps_map_tilesLocations' );
	const basePath      = (tilesLocation === 'remote')
		? `${ TILES_REMOTE_HOST }/maps/${ type }/${ game }/`
		: `http://${ window.location.hostname }:3000/maps/${ type }/${ game }/`;
	
	Vue.prototype.$pushALog( `Base path: ${ basePath } | Type: ${ type } | Tile location: ${ tilesLocation }`,
		_history.HTY_ZONE.MAPS_INIT );
	
	d.paths.base = basePath;
	
	return axios
		.get( d.paths.base + d.paths.config )
		.then( response => {
			//console.log( 'config', response.data );
			d.config = response.data;
			Vue.prototype.$pushALog( `Map config found`, _history.HTY_ZONE.MAPS_INIT );
			
			const tilesPath = d.paths.tiles.replace( /{[xyz]}/g, 0 );
			
			//console.log( tilesPath );
			
			return axios
				.get( d.paths.base + tilesPath )
				.then( response => {
					Vue.prototype.$pushALog( `Tiles OK: ${ d.paths.base + tilesPath }`, _history.HTY_ZONE.MAPS_INIT );
					//console.log( 'tiles', response );
					//d.config = response.data;
					
					d.ready = true;
					
				}, err => {
					console.error( 'Cant get tiles', err );
					Vue.prototype.$pushALog( `Tiles NOT FOUND`, _history.HTY_ZONE.MAPS_INIT, _history.HTY_LEVEL.ERROR );
					throw 'Tiles NOT FOUND';
				} );
			
		}, err => {
			console.error( 'Cant get config', err );
			Vue.prototype.$pushALog( `Map config NOT FOUND`, _history.HTY_ZONE.MAPS_INIT, _history.HTY_LEVEL.ERROR );
			throw 'Map config NOT FOUND';
		} );
	
	//console.log( game, type, tilesLocation, basePath );
	//console.log( d.paths );
};

const initMap = () => {
	let projection = new ol.proj.Projection( {
		// Any name here. I chose "Funbit" because we are using funbit's image coordinates.
		code:        'Funbit',
		units:       'pixels',
		extent:      [ 0, 0, d.config.map.maxX, d.config.map.maxY ],
		worldExtent: [ 0, 0, d.config.map.maxX, d.config.map.maxY ]
	} );
	ol.proj.addProjection( projection );
	
	// Adding a marker for the player position/rotation.
	d.playerIcon = new ol.style.Icon( {
		anchor:         [ 0.5, 39 ],
		scale:          .7,
		anchorXUnits:   'fraction',
		anchorYUnits:   'pixels',
		rotateWithView: true,
		src:            'https://github.com/meatlayer/ets2-mobile-route-advisor/raw/master/img/player_proportions.png'
	} );
	
	let playerIconStyle = new ol.style.Style( {
		image: d.playerIcon
	} );
	d.playerFeature     = new ol.Feature( {
		geometry: new ol.geom.Point( [ d.config.map.maxX / 2, d.config.map.maxY / 2 ] )
	} );
	// For some reason, we cannot pass the style in the constructor.
	d.playerFeature.setStyle( playerIconStyle );
	
	// Adding a layer for features overlaid on the map.
	let featureSource = new ol.source.Vector( {
		features: [ d.playerFeature ],
		wrapX:    false
	} );
	let vectorLayer   = new ol.layer.Vector( {
		source: featureSource
	} );
	
	// Configuring the custom map tiles.
	let custom_tilegrid = new ol.tilegrid.TileGrid( {
		extent:      [ 0, 0, d.config.map.maxX, d.config.map.maxY ],
		minZoom:     ZOOM_MIN,
		origin:      [ 0, d.config.map.maxY ],
		tileSize:    d.map.tileSize,//[ 512, 512 ],
		resolutions: (function () {
			let r = [];
			for ( let z = 0; z <= 8; ++z ) {
				r[ z ] = Math.pow( 2, 8 - z );
			}
			return r;
		})()
	} );
	
	// Creating custom controls.
	//let rotate_control = new ol.control.Control( {
	//	//target: 'rotate-button-div'
	//	element: document.getElementById( 'rotate-wrapper' )
	//} );
	/*let speed_limit_control = new ol.control.Control({
	 element: document.getElementById('speed-limit')
	 });
	 let text_control = new ol.control.Control({
	 element: document.getElementById('map-text')
	 });*/
	
	// Creating the map.
	d.map = new ol.Map( {
		target:   'map',
		controls: [
			//new ol.control.ZoomSlider(),
			//new ol.control.OverviewMap(),
			//new ol.control.Rotate(),
			// new ol.control.MousePosition(),  // DEBUG
			// FIXME: Add way to custom the icon
			new ol.control.Zoom( {
				className: 'ol-zoom',
				//zoomInLabel:  '<i class="fas fa-search-plus"></i>',
				//zoomOutLabel: '<i class="fas fa-search-minus"></i>',
				target: 'ol-zoom-wrapper'
			} )
			//rotate_control
			//speed_limit_control,
			//text_control
			// TODO: Set 'tipLabel' on both zoom and rotate controls to language-specific translations.
		],
		/*interactions: ol.interaction.defaults().extend( [
		 // Rotating by using two fingers is implemented in PinchRotate(), which is enabled by default.
		 // With DragRotateAndZoom(), it is possible to use Shift+mouse-drag to rotate the map.
		 // Without it, Shift+mouse-drag creates a rectangle to zoom to an area.
		 //new ol.interaction.DragRotateAndZoom()
		 ] ),*/
		layers: [
			getMapTilesLayer( projection, custom_tilegrid ),
			//getTextLayer(),
			// Debug layer below.
			//new ol.layer.Tile({
			//	extent: [0, 0, MAX_X, MAX_Y],
			//	source: new ol.source.TileDebug({
			//		projection: projection,
			//		tileGrid: custom_tilegrid,
			//		// tileGrid: ol.tilegrid.createXYZ({
			//		//  extent: [0, 0, MAX_X, MAX_Y],
			//		//  minZoom: 0,
			//		//  maxZoom: 7,
			//		//  tileSize: [256, 256]
			//		// }),
			//		wrapX: false
			//	})
			//}),
			vectorLayer
		],
		view:   new ol.View( {
			projection: projection,
			extent:     [ 0, 0, d.config.map.maxX, d.config.map.maxY ],
			//center: ol.proj.transform([37.41, 8.82], 'EPSG:4326', 'EPSG:3857'),
			center:  [ d.config.map.maxX / 2, d.config.map.maxY / 2 ],
			minZoom: ZOOM_MIN,
			maxZoom: ZOOM_MAX,
			zoom:    ZOOM_DEFAULT
		} )
	} );
	
	// Adding behavior to the custom button.
	//let rotate_button = document.getElementById( 'rotate-button' );
	//let rotate_arrow  = rotate_button.firstElementChild;
	//d.map.getView().on( 'change:rotation', function ( ev ) {
	//	//console.log( 'Plop' );
	//	d.arrowRotate = {
	//		transform: `rotate(${ ev.target.getRotation() }rad)`
	//	};
	//} );
	
	// Detecting when the user interacts with the map.
	// https://stackoverflow.com/q/32868671/
	d.map.getView().on( [ 'change:center', 'change:rotation' ], function ( ev ) {
		//console.log( 'Hola', d.gIgnoreViewChangeEvents );
		
		if ( d.gIgnoreViewChangeEvents ) {
			return;
		}
		// The user has moved or rotated the map.
		d.gBehaviorCenterOnPlayer = false;
		// Not needed:
		// g_behavior_rotate_with_player = false;
	} );
	
	// Debugging.
	//d.map.getView().on('singleclick', function(evt) {
	//	let coordinate = evt.coordinate;
	//	console.log(coordinate);
	//});
	// map.getView().on('change:center', function(ev) {
	//   console.log(ev);
	// });
	// map.getView().on('change:rotation', function(ev) {
	//   console.log(ev);
	// });
};

const init = ( game ) => {
	return initConfig( game )
		.then( () => initMap() );
};

// ----

const getMapTilesLayer = ( projection, tileGrid ) => {
	return new ol.layer.Tile( {
		extent: [ 0, 0, d.config.map.maxX, d.config.map.maxY ],
		source: new ol.source.XYZ( {
			projection: projection,
			//url:
			// 'https://github.com/meatlayer/ets2-mobile-route-advisor/raw/master/maps/ets2/tiles/{z}/{x}/{y}.png',
			url:      d.paths.base + d.paths.tiles,
			tileSize: d.map.tileSize,//[ 512, 512 ],
			// Using createXYZ() makes the vector layer (with the features) unaligned.
			// It also tries loading non-existent tiles.
			//
			// Using custom_tilegrid causes rescaling of all image tiles before drawing
			// (i.e. no image will be rendered at 1:1 pixels), But fixes all other issues.
			tileGrid: tileGrid,
			// tileGrid: ol.tilegrid.createXYZ({
			//     extent: [0, 0, MAX_X, MAX_Y],
			//     minZoom: 0,
			//     maxZoom: 7,
			//     tileSize: [256, 256]
			// }),
			wrapX:   false,
			minZoom: ZOOM_MIN,
			maxZoom: ZOOM_MAX
		} )
	} );
};

const updatePlayerPositionAndRotation = ( lon, lat, rot, speed ) => {
	
	if ( d.ready === null )
		return;
	
	let map_coords = gameCoordToPixels( lon, lat );
	let rad        = rot * Math.PI * 2;
	
	d.playerFeature.getGeometry().setCoordinates( map_coords );
	d.playerIcon.setRotation( -rad );
	
	d.gIgnoreViewChangeEvents = true;
	if ( d.gBehaviorCenterOnPlayer ) {
		
		if ( d.gBehaviorRotateWithPlayer ) {
			let height           = d.map.getSize()[ 1 ];
			let max_ahead_amount = height / 3.0 * d.map.getView().getResolution();
			
			//console.log(parseFloat((speed).toFixed(0)));
			//auto-zoom map by speed
			if ( parseFloat( (speed).toFixed( 0 ) ) >= 15 && parseFloat( (speed).toFixed( 0 ) ) <= 35 ) {
				d.map.getView().getZoom( d.map.getView().setZoom( 9 ) );
			} else if ( parseFloat( (speed).toFixed( 0 ) ) >= 51 && parseFloat( (speed).toFixed( 0 ) ) <= 55 ) {
				d.map.getView().getZoom( d.map.getView().setZoom( 8 ) );
			} else if ( parseFloat( (speed).toFixed( 0 ) ) >= 61 && parseFloat( (speed).toFixed( 0 ) ) <= 65 ) {
				d.map.getView().getZoom( d.map.getView().setZoom( 7 ) );
			} else if ( parseFloat( (speed).toFixed( 0 ) ) >= 81 && parseFloat( (speed).toFixed( 0 ) ) <= 88 ) {
				d.map.getView().getZoom( d.map.getView().setZoom( 6 ) );
			}
			
			let amount_ahead = speed * 0.25;
			amount_ahead     = Math.max( -max_ahead_amount, Math.min( amount_ahead, max_ahead_amount ) );
			
			let ahead_coords = [
				map_coords[ 0 ] + Math.sin( -rad ) * amount_ahead,
				map_coords[ 1 ] + Math.cos( -rad ) * amount_ahead
			];
			d.map.getView().setCenter( ahead_coords );
			d.map.getView().setRotation( rad );
			
		} else {
			d.map.getView().setCenter( map_coords );
			d.map.getView().setRotation( 0 );
		}
	}
	d.gIgnoreViewChangeEvents = false;
};

const gameCoordToPixels = ( x, y ) => {
	if ( d.ready === null )
		return;
	
	//let r = [ x / 1.087326 + 57157, y / 1.087326 + 59287 ];
	let r = [ x / d.config.transposition.x.factor + d.config.transposition.x.offset, y
																					 / d.config.transposition.y.factor
																					 + d.config.transposition.y.offset ];
	
	// The United Kingdom of Great Britain and Northern Ireland
	//if ( x < -31056.8 && y < -5832.867 ) {
	//	let r = [ x / 1.087326 + 57157, y / 1.087326 + 59287 ];
	//}
	r[ 1 ] = d.config.map.maxY - r[ 1 ];
	return r;
};

export default {
	d,
	init,
	getMapTilesLayer,
	updatePlayerPositionAndRotation,
	gameCoordToPixels
};