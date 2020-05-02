let app = angular.module("ucraft", ["ngRoute", "ngSanitize"]);

var steemAccount = "ucraft";

app.config(['$locationProvider', function ($locationProvider) {
	$locationProvider.html5Mode(false);
	$locationProvider.hashPrefix('');
}]);

app.run(function ($rootScope, $location) {
	$rootScope.$applyAsync();
});

app.controller('Main', function ($scope, $routeParams) {
	$scope.loadPosts = function () {
		console.log("Loading posts...");
		var posts = [];
		let parsed = 0;

		let startFrom = 0;
		if($routeParams.page){
			startFrom = (($routeParams.page - 1) * 5);
		}

		steem.api.getBlogEntries(steemAccount, startFrom, 5, function (err, data) {
			if(err){
				console.log(err);
			}
			
			console.log(data);
			for (var i = 0; i < data.length; i++) {
				console.log(i);
				steem.api.getContent(data[i].author, data[i].permlink, function(err, result){
					var body = result.body;
                    if (body.length >= 500) {
                        body = body.substring(0, 499) + "... **[(Kliknij aby przeczytać cały tekst.)](blog/" + result.permlink + ")**";
                    }

                    posts.push({
                        'author': result.author,
                        'title': result.title,
                        'body': marked(body),
                        'date': dayjs(Date.parse(result.created)).format('DD.MM.YYYY HH:mm'),
						'dateInt': dayjs(Date.parse(result.created)).valueOf(),
                        'permlink': result.permlink
                    });

                    parsed++;

                    if (data.length - 1 === parsed) {
                        posts.sort(function (a, b) {
                            return b.dateInt - a.dateInt
                        });
                        console.log(posts);
                        $scope.posts = posts;
                        $scope.$applyAsync();
                    }
				});
			}
		});
	};
});

app.controller("PostController", function ($scope, $routeParams) {
	$scope.loadPost = function () {
		let post = steem.api.getContentAsync(steemAccount, $routeParams.permlink);
		post.then(result => {
			console.log(result);
            $scope.post = {
            	'author': result.author,
				'title': result.title,
				'body': marked(result.body),
				'date': dayjs(Date.parse(result.created)).format('DD.MM.YYYY HH:mm'),
				'permlink': result.permlink
            };
            $scope.$applyAsync();
		})
	};
});

app.config(function ($routeProvider) {
	$routeProvider
		.when("/", {
			controller: "Main",
			templateUrl: "app/views/index.html"
		})
		.when("/page/:page", {
			controller: "Main",
			templateUrl: "app/views/index.html"
		})
		.when("/unban", {
			templateUrl: "app/views/unban.html"
		})
		.when("/blog/:permlink", {
			controller: "PostController",
			templateUrl: "app/views/blogPost.html"
		})
		.otherwise({
			templateUrl: 'app/404.html'
		});
});