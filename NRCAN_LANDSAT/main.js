// Functions to add NDVI band to image ---
var addNDVI1 = function(image) {
    var ndvi = image.normalizedDifference(['B4', 'B3']).rename('NDVI');
    return(image.addBands(ndvi));
}
var addNDVI2 = function(image) {
    var ndvi = image.normalizedDifference(['B5', 'B4']).rename('NDVI');
    return(image.addBands(ndvi));
}
// ---

// Functions to add DATE band to image ---
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
var get_value = function(ogImg, geo, scale ) {
    var meanDictionary = ogImg.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: geo,
      scale: scale,
      maxPixels: 1e9
    });
    
    return(meanDictionary)
}
// ---

// Function to mask cloud from built-in quality band ---
var getQABits = function(image, start, end, newName) {
    // Compute the bits we need to extract.
    var pattern = 0;
    for (var i = start; i <= end; i++) {
       pattern += Math.pow(2, i);
    }
    // Return a single band image of the extracted QA bits, giving the band
    // a new name.
    return image.select([0], [newName])
                  .bitwiseAnd(pattern)
                  .rightShift(start);
};
// A function to mask out cloudy pixels.
var cloud_shadows = function(image) {
  // Select the QA band.
  var QA = image.select(['pixel_qa']);
  // Get the internal_cloud_algorithm_flag bit.
  return getQABits(QA, 3,3, 'cloud_shadows').eq(0);
  // Return an image masking out cloudy areas.
};
// A function to mask out cloudy pixels.
var clouds = function(image) {
  // Select the QA band.
  var QA = image.select(['pixel_qa']);
  // Get the internal_cloud_algorithm_flag bit.
  return getQABits(QA, 5,5, 'Cloud').eq(0);
  // Return an image masking out cloudy areas.
};
var maskClouds = function(image) {
  var cs = cloud_shadows(image);
  var c = clouds(image);
  image = image.updateMask(cs);
  return image.updateMask(c);
};
// ---


// Helper functions ---
var importImage = function(sDate, eDate, roi) {
  // Load the Landsat scaled radiance image collection.
  //select l5
  var l5 = ee.ImageCollection('LANDSAT/LT05/C01/T1_SR')
      .filterBounds(roi)
      .filterDate(sDate, eDate)
      .filterMetadata('CLOUD_COVER','less_than',75);
  //select l7
  var l7 = ee.ImageCollection('LANDSAT/LE07/C01/T1_SR')
      .filterBounds(roi)
      .filterDate(sDate, eDate)
      .filterMetadata('CLOUD_COVER','less_than',30);
  //select l8
  var l8 = ee.ImageCollection("LANDSAT/LC08/C01/T1_SR")
      .filterBounds(roi)
      .filterDate(sDate, eDate)
      .filterMetadata('CLOUD_COVER','less_than',75);
  
  //compress into one big 'collection'
  var lmix = {
    'l5': l5,
    'l7': l7,
    'l8': l8
  }
  // Return the big collection to main
  return(lmix);
}
// ---

// Dependencies ---
//   Make sure the date format follows the exact structure
//   As the format listed below
var base = 2000
var cap = 2020
var start = '-06-01'
var end = '-08-31'
var sDate = base.toString()+start
var eDate = base.toString()+end
var imageCol = {}
// THIS COLLECTION PATH NEEDS TO BE CHANGED TO WHERE 
//   THE CURRENT ROI GEOMETRY FILE IS IN THE CODE EDITOR
//   E.G. 'users/yourname/geometry'
var roi = ee.FeatureCollection('users/tonywangs/Envelope_LCC')
var counter = 0
// ---

// landsat 5 ---
// Fetch images from GEE and store them in their respective collections
for (var i = base; i <= cap; i++) {
    sDate = i.toString()+start
    eDate = i.toString()+end
    var Landsat7Collection = importImage(sDate, eDate, roi).l5
    
    // Check if aggregated image collection is empty
    if (imageCol[counter] === undefined) {
          imageCol[counter] = Landsat7Collection
    }
    else {
      imageCol[counter] = imageCol[counter].merge(Landsat7Collection)
    }
    if ((i-base)%5 === 0) {
      var name1 = (i-4)+'-'+i+'_'+'LANDSAT5'
      print(name1)
      // create an NDVI mask for each collection
      var withNDVI = imageCol[counter]
        .map(addNDVI1)
        // UNCOMMENT THESE LINES TO ALLOW DATE BANDS IN LANDSAT IMAGE
        //.map(addYear)
        //.map(addMonth)
        //.map(addDay)
        .map(maskClouds);
      var onlyNDVI = withNDVI.select(['NDVI'])
      print(withNDVI)
      // create greenest pixel composite
      var greenest = withNDVI.reduce(ee.Reducer.max(onlyNDVI.first().bandNames().size()))
        .rename(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'sr_atmos_opacity', 'sr_cloud_qa', 'pixel_qa', 'radsat_qa', 'NDVI']);
        //.rename(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'BQA', 'NDVI', 'year', 'month', 'day']))
      print(greenest)
  
      // Display the result
      var display = {bands: ['B3', 'B2', 'B1']}
      Map.addLayer(greenest, display, name1)
      
      
      // Export to GDrive
      
      //print('Projection, crs, and crs_transform:', exportedImg.projection());
      //print('Scale in meters:', exportedImg.projection().nominalScale());
      var exportedImg = ee.Image(greenest
        .select(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7']))
        //.select(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'BQA', 'NDVI', 'year', 'month', 'day']))
      
      Export.image.toDrive({
        image: exportedImg,
        folder: 'LANDSAT 5',
        description: name1+"_MOSAIC",
        fileFormat: 'GeoTIFF',
        region: roi,
        maxPixels: 1116247392, // value set only for exporting true-resolution LANDSAT scene
        crs: 'EPSG:2958'
      })
      counter++
    }
}
// ---

// landsat 7 ---
// Fetch images from GEE and store them in their respective collections
for (var i = base; i <= cap; i++) {
    sDate = i.toString()+start
    eDate = i.toString()+end
    var Landsat7Collection = importImage(sDate, eDate, roi).l7
    
    // Check if aggregated image collection is empty
    if (imageCol[counter] === undefined) {
          imageCol[counter] = Landsat7Collection
    }
    else {
      imageCol[counter] = imageCol[counter].merge(Landsat7Collection)
    }
    //print(imageCol[counter])
    if ((i-base)%5 === 0) {
      var name2 = (i-4)+'-'+i+'_'+'LANDSAT7'
      print(name2)
      // create an NDVI mask for each collection
      var withNDVI = imageCol[counter]
        .map(addNDVI1)
        //.map(addYear)
        //.map(addMonth)
        //.map(addDay)
        .map(maskClouds);
      var onlyNDVI = withNDVI.select(['NDVI'])
      print(withNDVI)
      // create greenest pixel composite
      var greenest = withNDVI.reduce(ee.Reducer.max(onlyNDVI.first().bandNames().size()))
        .rename(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'sr_atmos_opacity', 'sr_cloud_qa', 'pixel_qa', 'radsat_qa', 'NDVI']);
        //.rename(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'BQA', 'NDVI', 'year', 'month', 'day']))
      print(greenest)
  
      // Display the result
      var display = {bands: ['B4', 'B3', 'B2']}
      Map.addLayer(greenest, display, name2)
      
      
      // Export to GDrive
      
      //print('Projection, crs, and crs_transform:', exportedImg.projection());
      //print('Scale in meters:', exportedImg.projection().nominalScale());
      var exportedImg = ee.Image(greenest
        .select(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7']))
        //.select(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'BQA', 'NDVI', 'year', 'month', 'day']))
      
      Export.image.toDrive({
        image: exportedImg,
        folder: 'LANDSAT 7',
        description: name2+"_MOSAIC",
        fileFormat: 'GeoTIFF',
        region: roi,
        maxPixels: 1116247392, // value set only for exporting true-resolution LANDSAT scene
        crs: 'EPSG:2958'
      })
      counter++
    }
}
// ---

// landsat 8 ---
// Fetch images from GEE and store them in their respective collections
for (var i = base; i <= cap; i++) {
    sDate = i.toString()+start
    eDate = i.toString()+end
    var Landsat7Collection = importImage(sDate, eDate, roi).l8
    
    // Check if aggregated image collection is empty
    if (imageCol[counter] === undefined) {
          imageCol[counter] = Landsat7Collection
    }
    else {
      imageCol[counter] = imageCol[counter].merge(Landsat7Collection)
    }
    //print(imageCol[counter])
    if ((i-base)%5 === 0) {
      var name3 = (i-4)+'-'+i+'_'+'LANDSAT8'
      print(name3)
      // create an NDVI mask for each collection
      var withNDVI = imageCol[counter]
        .map(addNDVI2)
        //.map(addYear)
        //.map(addMonth)
        //.map(addDay)
        .map(maskClouds);
      var onlyNDVI = withNDVI.select(['NDVI'])
      print(withNDVI)
      // create greenest pixel composite
      var greenest = withNDVI.reduce(ee.Reducer.max(onlyNDVI.first().bandNames().size()))
        .rename(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B10', 'B11', 'sr_aerosol', 'pixel_qa', 'radsat_qa', 'NDVI']);
        //.rename(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'BQA', 'NDVI', 'year', 'month', 'day']))
      print(greenest)
  
      // Display the result
      var display = {bands: ['B5', 'B4', 'B3']}
      Map.addLayer(greenest, display, name3)
      
      
      // Export to GDrive
      
      //print('Projection, crs, and crs_transform:', exportedImg.projection());
      //print('Scale in meters:', exportedImg.projection().nominalScale());
      var exportedImg = ee.Image(greenest
        .select(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B10', 'B11']))
        //.select(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'BQA', 'NDVI', 'year', 'month', 'day']))
      
      Export.image.toDrive({
        image: exportedImg,
        folder: 'LANDSAT 8',
        description: name3+"_MOSAIC",
        fileFormat: 'GeoTIFF',
        region: roi,
        maxPixels: 1116247392, // value set only for exporting true-resolution LANDSAT scene
        crs: 'EPSG:2958'
      })
      counter++
    }
}
// ---