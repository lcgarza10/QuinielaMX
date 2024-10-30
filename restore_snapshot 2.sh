#!/bin/bash
echo "Restoring project files..."
cp -R src angular.json package.json tsconfig.json VERSION.txt ./
echo "Project snapshot restored."