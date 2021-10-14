# Redis / Node.js Crash Course

This is the source code repository for the [Node.js Redis Crash Course](https://developer.redis.com/develop/node/node-crash-course).  It's designed to be used with the workbooks and videos that make up the course.

If you are looking for solutions to the coding exercises that form an optional part of the course, check out the `solutions` branch.

Check out our [YouTube channel](https://youtube.com/redisinc) for regular new Redis content!

## Software Prerequisites

To get the most from this course, you'll need a machine that can run Node.js applications, plus Docker as we'll be using a container that includes Redis and the required add-on modules for this course.

You'll need the following installed on your machine:

* [Docker](https://www.docker.com/) (you'll need the docker-compose command)
* [Node.js](https://nodejs.org/) (use the current Long Term Stable - LTS - version)
* [git]() command line tools
* Your favorite IDE (we like [VSCode](https://git-scm.com/downloads), but anything you're comfortable with works)
* [Postman](https://www.postman.com/) - we're going to make some API calls and Postman makes that easy.

## Application Overview

In this course, we'll look at how to use Redis as a data store and cache in the context of a sample application. Imagine that we're building a sort of social network application where users can "check in" at different locations and give them a star rating… from 0 for an awful experience through 5 to report that they had the best time ever there!

When designing our application, we determined that there's a need to manage data about three main entities:

* Users
* Locations
* Checkins
 
Let's look at what we're storing about each of these entities. As we're using Redis as our only data store, we'll also consider how they map to Redis data types…

### Users

We'll represent each user as a flat map of name/value pairs with no nested objects. As we'll see later on, this maps nicely to a Redis Hash. Here's a JSON representation of the schema we'll use to represent each user:

```json
{
  "id": 99,
  "firstName": "Isabella",
  "lastName": "Pedersen",
  "email": "isabella.pedersen@example.com",
  "password": "xxxxxx1",
  "numCheckins": 8073,
  "lastCheckin": 1544372326893,
  "lastSeenAt": 138
}
```
 
We've given each user an ID and we're storing basic information about them. Also, we’ll encrypt their password using bcrypt when we load the sample data into Redis.

For each user, we'll keep track of the total number of checkins that they've submitted to the system, and the timestamp and location ID of their most recent checkin so that we know where and when they last used the system.

### Locations

For each location that users can check in at, we're going to maintain two types of data. The first of these is also a flat map of name/value pairs, containing summary information about the location:

```json
{
  "id": 138,
  "name": "Stacey's Country Bakehouse",
  "category": "restaurant",
  "location": "-122.195447,37.774636",
  "numCheckins": 170,
  "numStars": 724,
  "averageStars": 4
}
```

We've given each location an ID and a category—we'll use the category to search for locations by type later on. The "location" field stores the coordinates in longitude, latitude format… this is the opposite from the usual latitude, longitude format. We'll see how to use this to perform geospatial searches later when we look at the RediSearch module.

For each location, we're also storing the total number of checkins that have been recorded there by all of our users, the total number of stars that those checkins gave the location, and an average star rating per checkin for the location.

The second type of data that we want to maintain for each location is what we'll call "location details". These take the form of more structured JSON documents with nested objects and arrays. Here's an example for location 138, Stacey's Country Bakehouse:

```json
{
  "id": 138,
  "hours": [
    { "day": "Monday", "hours": "8-7" },
    { "day": "Tuesday", "hours": "9-7" },
    { "day": "Wednesday", "hours": "6-8" },
    { "day": "Thursday", "hours": "6-6" },
    { "day": "Friday", "hours": "9-5" },
    { "day": "Saturday", "hours": "8-9" },
    { "day": "Sunday", "hours": "7-7" }
  ],
  "socials": [
    { 
      "instagram": "staceyscountrybakehouse",
      "facebook": "staceyscountrybakehouse",
      "twitter": "staceyscountrybakehouse"
    }
  ],
  "website": "www.staceyscountrybakehouse.com",
  "description": "Lorem ipsum....",
  "phone": "(316) 157-8620"
}
```

We want to build an API that allows us to retrieve all or some of these extra details, and keep the overall structure of the document intact. For that, we'll need the RedisJSON module as we'll see later.

### Checkins

Checkins differ from users and locations in that they're not entities that we need to store forever. In our application, checkins consist of a user ID, a location ID, a star rating and a timestamp - we'll use these values to update attributes of our users and locations.

 Each checkin can be thought of as a flat map of name/value pairs, for example:

```json
{
  "userId": 789,
  "locationId": 171,
  "starRating": 5
}
```

Here, we see that user 789 visited location 171 ("Hair by Parvinder") and was really impressed with the service.

We need a way to store checkins for long enough to process them, but not forever. We also need to associate a timestamp with each one, as we'll need that when we process the data. 

Redis provides a Stream data type that's perfect for this - with Redis Streams, we can store maps of name/value pairs and have the Redis server timestamp them for us. Streams are also perfect for the sort of asynchronous processing we want to do with this data. When a user posts a new checkin to our API we want to store that data and respond to the user that we've received it as quickly as possible. Later we can have one or more other parts of the system do further processing with it. Such processing might include updating the total number of checkins and last seen at fields for a user, or calculating a new average star rating for a location.

## Application Architecture

We decided to use Node.js with the Express framework and ioredis client to build the application. Rather than have a monolithic codebase, the application has been split out into four components or services. These are:

* **Authentication Service**: Listens on an HTTP port and handles user authentication using Redis as a shared session store that other services can access.
* **Checkin Receiver**: Listens on an HTTP port and receives checkins as HTTP POST requests from our users. Each checkin is placed in a Redis Stream for later processing.
* **Checkin Processor**: Monitors the checkin Stream in Redis, updating user and location information as it processes each checkin.
* **API Server**: Implements the bulk of the application's API endpoints, including those to retrieve information about users and locations from Redis.

There's also a data loader component, which we'll use to load some initial sample data into the system.

## Setup / Installation Process

### Get the Code and Install Dependencies
 
Clone the course repo from GitHub and install the dependencies:

```bash
$ git clone https://github.com/redislabs-training/node-js-crash-course.git
$ cd node-js-crash-course
$ npm install
```

### Start Redis (Docker)
 
From the node-js-crash-course directory, start Redis using `docker-compose` (note: use `docker-compose` with the "-", **not** "`docker compose`":

```bash
$ docker-compose up -d

Creating network "node-js-crash-course_default" with the default driver
Creating rediscrashcourse ... done

$ docker ps
```

The output from the `docker ps` command should show one container running, using the "redislabs/redismod" image. This container runs Redis 6 with the RediSearch, RedisJSON and RedisBloom modules.

### Load the Sample Data into Redis
 
Load the course example data using the provided data loader. This is a Node.js application:

```bash
$ npm run load all
> node src/utils/dataloader.js -- "all"

Loading user data...
User data loaded with 0 errors.
Loading location data...
Location data loaded with 0 errors.
Loading location details...
Location detail data loaded with 0 errors.
Loading checkin stream entries...
Loaded 5000 checkin stream entries.
Creating consumer group...
Consumer group created.
Dropping any existing indexes, creating new indexes...
Created indexes.
Deleting any previous bloom filter, creating new bloom filter...
Created bloom filter.
```
 
In another terminal window, run the `redis-cli` executable that's in the Docker container. Then, enter the Redis commands shown at the redis-cli prompt to verify that data loaded successfully:

```bash
$ docker exec -it rediscrashcourse redis-cli
127.0.0.1:6379> hgetall ncc:locations:106

 1) "id"
 2) "106"
 3) "name"
 4) "Viva Bubble Tea"
 5) "category"
 6) "cafe"
 7) "location"
 8) "-122.268645,37.764288"
 9) "numCheckins"
10) "886"
11) "numStars"
12) "1073"
13) "averageStars"
14) "1"

127.0.0.1:6379> hgetall ncc:users:12
 1) "id"
 2) "12"
 3) "firstName"
 4) "Franziska"
 5) "lastName"
 6) "Sieben"
 7) "email"
 8) "franziska.sieben@example.com"
 9) "password"
10) "$2b$05$uV38PUcdFD3Gm6ElMlBkE.lzZutqWVE6R6ro48GsEjcmnioaZZ55C"
11) "numCheckins"
12) "8945"
13) "lastCheckin"
14) "1490641385511"
15) "lastSeenAt"
16) "22"

127.0.0.1:6379> xlen ncc:checkins
(integer) 5000
```

## Start the Application

Now it's time to start the API Server component of the application and make sure it connects to Redis. This component listens on port 8081.

If port 8081 is in use on your system, edit this section of the `config.json` file and pick another available port:

```json
"application": {
  "port": 8081
},
```

Start the server like this:

```bash
$ npm run dev
> ./node_modules/nodemon/bin/nodemon.js
[nodemon] 2.0.7
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): *.*
[nodemon] watching extensions: js,mjs,json
[nodemon] starting `node src/server.js`
Warning: Environment variable WEATHER_API_KEY is not set!
info: Application listening on port 8081.
```
 
This starts the application using nodemon, which monitors for changes in the source code and will restart the server when a change is detected.

Ignore the warning about `WEATHER_API_KEY` — we'll address this in one of the course exercises when we look at using Redis as a cache.

To verify that the server is running correctly and connected to Redis, point your browser at:

`http://localhost:8081/api/location/200`

You should see the summary information for location 200, Katia's Kitchen:

```json
{
  "id": "200",
  "name": "Katia's Kitchen",
  "category": "restaurant",
  "location": "-122.2349598,37.7356811",
  "numCheckins": "359",
  "numStars": "1021",
  "averageStars": "3"
}
```
 
Great! Now you're up and running. 

## Using an Alternative Configuration File

If you want to use an alternative configuration file, create a copy of `config.json`... for example `my_config.json`.  Then, set an environment variable as follows:

```bash
$ cd node-js-crash-course
$ export CRASH_COURSE_CONFIG_FILE=my_config.json
```

Start the application as described above and it should now use values from your new config file.  Note that the config file should be in the root folder of this repository (where you'll find the supplied `config.json`).
