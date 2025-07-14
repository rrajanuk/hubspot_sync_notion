#!/bin/bash
# Deploy script for Google Apps Script project with clasp and git
git add .
git commit -m "Automated sync and deployment"
git push origin main
clasp push
