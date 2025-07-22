#!/bin/bash
git pull origin staging
docker-compose down
docker-compose up -d --build