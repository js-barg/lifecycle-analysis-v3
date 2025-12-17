#!/bin/bash
# Check the failed build logs

BUILD_ID="f5547828-2cfa-4adf-831d-ea53509b8b13"

echo "Checking logs for build $BUILD_ID..."
echo ""

gcloud builds log $BUILD_ID | tail -100

echo ""
echo "Or view in console:"
echo "https://console.cloud.google.com/cloud-build/builds/$BUILD_ID?project=lifecycle-analysis-477518"


