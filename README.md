Google Earth Engine (GEE) script written in JavaScript. 
The purpose of these scripts are to create a time-series of a region of interest from LANDSAT and SENTINEL satellites.
The images are reconstructed by maximizing NDVI values in each image for every image collection, and are then cleared of clouds utilizing a cloud-mask function.
NOTE: These scripts are meant to be used in the Code Editor in Google Earth Engine, but can be adapted to be used in any JavaScript application.

To use:
- Load code into GEE Code Editor
- Select region of interest (ROI) in pre-made map, or load in pre-existing ROI (in the form of a shapefile)
    *in both of these circumstances they must be renamed to 'roi'
- Change start-date and end-date, as well as interval of time for each mosaic (in specified locations in the script)
- Click 'run' in the Code Editor to run the script
    *error messages during the runtime of the script is normal; they most likely indicate the occurance of dates in which images are unavailable for certain satellites.
    
To export images:
- After 'run' has been clicked, switch to the 'tasks' tab in the Code Editor
- Run each task (will state the year of the image) to export mosaics to Google Drive of current Google Account
