// Functions
var addNDVI2 = function(image) {
    var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
    return(image.addBands(ndvi));
}
var addYear = function(image) {
  var doy = image.date().get('year');
  var doyBand = ee.Image.constant(doy).uint16().rename('year')
  doyBand = doyBand.updateMask(image.select('B8').mask())

  return image.addBands(doyBand);
}

var addMonth = function(image) {
  var doy = image.date().get('month');
  var doyBand = ee.Image.constant(doy).uint16().rename('month')
  doyBand = doyBand.updateMask(image.select('B8').mask())

  return image.addBands(doyBand);
}

var addDay = function(image) {
  var doy = image.date().get('day');
  var doyBand = ee.Image.constant(doy).uint16().rename('day')
  doyBand = doyBand.updateMask(image.select('B8').mask())

  return image.addBands(doyBand);
}

var getId = function(obj) {
  var lat = obj.lat
  var lon = obj.lon
  var point = ee.Geometry.Point([lon, lat])
  var date = get_value(greenest, point, 30).get('date')
  date = ee.Date(ee.Number(date).multiply(1000).multiply(3600))
  print(date)
  var img = ee.Image(imageCol[counter-1].filterDate(date, date.advance(1, 'day')).first())
  print('Img id in point ['+lon+","+lat+"] is", img.id())
  print('Gain: ', img.get('REFLECTANCE_MULT_BAND_1'))
  print('Offset: ', img.get('REFLECTANCE_ADD_BAND_1'))
}

// Function to mask cloud from built-in quality band
// information on cloud
var maskClouds = function(image) {
  var QA60 = image.select(['QA60']);
  var clouds = QA60.bitwiseAnd(1<<10).or(QA60.bitwiseAnd(1<<11))// this gives us cloudy pixels
  return image.updateMask(clouds.not()); // remove the clouds from image
};

/////////////////////////
// Helper functions
/////////////////////////
var importImage = function(sDate, eDate, roi) {
  // Load the Sentinel scaled radiance image collection.
  //select l8
  var s2 = ee.ImageCollection("COPERNICUS/S2_SR")
      .filterBounds(roi)
      .filterDate(sDate, eDate)
      .filterMetadata('CLOUDY_PIXEL_PERCENTAGE','less_than',75);

  // Return the big collection to main
  return(s2);
}

var get_value = function(ogImg, geo, scale ) {
  var meanDictionary = ogImg.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geo,
    scale: scale,
    maxPixels: 1e9
  });
  
  return(meanDictionary)
}

// Dependencies
var base = 2017
var cap = 2020
var start = '-06-01'
var end = '-08-31'
var sDate = base.toString()+start
var eDate = base.toString()+end
var imageCol = {}
var roi = ee.FeatureCollection('users/tonywangs/Envelope_LCC')
var region = ee.Geometry.Rectangle(-81.374-0.5, 72.327, -77.374+0.5, 70.327)
var counter = 0


// Sentinel 2
// Fetch images from GEE and store them in their respective collections
for (var i = base; i <= cap; i++) {
    sDate = i.toString()+start
    eDate = i.toString()+end
    var Sent2Collection = importImage(sDate, eDate, region)
    
    // Check if aggregated image collection is empty
    if (imageCol[counter] === undefined) {
          imageCol[counter] = Sent2Collection
    }
    else {
      imageCol[counter] = imageCol[counter].merge(Sent2Collection)
    }
    if ((i-base)%2 === 0) {
      var name3 = (i-1)+'-'+i+'_'+'SENTINEL2'
      print(name3)
      // create an NDVI mask for each collection
      var withNDVI = imageCol[counter]
        .map(addNDVI2)
        //.map(addYear)
        //.map(addMonth)
        //.map(addDay)
        .map(maskClouds);
      print(withNDVI)
      var greenest = withNDVI.qualityMosaic('NDVI')

      
      // Display the result
      var display = {bands: ['B8', 'B4', 'B3']}
      Map.addLayer(greenest, display, name3)
      
      
      // Export to GDrive
      var exportedImg = greenest.select(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'])
      Export.image.toDrive({
        image: exportedImg,
        folder: 'SENTINEL-2',
        description: name3+"_MOSAIC",
        fileFormat: 'GeoTIFF',
        region: region,
        maxPixels: 1116247392, // value set only for exporting true-resolution LANDSAT scene
        crs: 'EPSG:2958'
      })
      
      counter++
    }
}


