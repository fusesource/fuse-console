function SubscriberGraphController($scope, workspace:Workspace) {
  $scope.workspace = workspace;
  $scope.nodes = [];
  $scope.links = [];
  $scope.queues = {};
  $scope.topics = {};
  $scope.subscriptions = {};
  $scope.producers = {};

  function matchesSelection(destinationName) {
    var selectionDetinationName = $scope.selectionDetinationName;
    return !selectionDetinationName || destinationName === selectionDetinationName;
  }

  function getOrCreate(container, key, defaultObject) {
    var value = container[key];
    var id;
    if (!value) {
      container[key] = defaultObject;
      id = $scope.nodes.length;
      defaultObject["id"] = id;
      $scope.nodes.push(defaultObject);
    } else {
      id = value["id"];
    }
    return id;
  }

  var populateSubscribers = function (response) {
    var data = response.value;
    for (var key in data) {
      var subscription = data[key];
      var destinationNameText = subscription["DestinationName"];
      if (destinationNameText) {
        var subscriptionId = null;
        var destinationNames = destinationNameText.split(",");
        destinationNames.forEach((destinationName) => {
          var id = null;
          var isQueue = !subscription["DestinationTopic"];
          if (isQueue === $scope.isQueue && matchesSelection(destinationName)) {
            if (isQueue) {
              id = getOrCreate($scope.queues, destinationName, {
                label: destinationName, imageUrl: url("/img/activemq/queue.png") });
            } else {
              id = getOrCreate($scope.topics, destinationName, {
                label: destinationName, imageUrl: url("/img/activemq/topic.png") });
            }

            // lets lazily register the subscription
            if (!subscriptionId) {
              var subscriptionKey = subscription["ConnectionId"] + ":" + subscription["SubcriptionId"];
              subscription["label"] = subscriptionKey;
              subscription["imageUrl"] = url("/img/activemq/listener.gif");
              subscriptionId = getOrCreate($scope.subscriptions, subscriptionKey, subscription);
            }

            $scope.links.push({ source: id, target: subscriptionId });
            // TODO add connections...?
          }
        });
      }
    }
  };

  var populateProducers = function (response) {
    var data = response.value;
    for (var key in data) {
      var producer = data[key];
      var destinationNameText = producer["DestinationName"];
      if (destinationNameText) {
        var producerId = null;
        var destinationNames = destinationNameText.split(",");
        destinationNames.forEach((destinationName) => {
          var id = null;
          var isQueue = producer["DestinationQueue"];
          if (isQueue === $scope.isQueue && matchesSelection(destinationName)) {
            if (isQueue) {
              id = getOrCreate($scope.queues, destinationName, {
                label: destinationName, imageUrl: "/img/activemq/queue.png" });
            } else {
              id = getOrCreate($scope.topics, destinationName, {
                label: destinationName, imageUrl: "/img/activemq/topic.png" });
            }

            // lets lazily register the producer
            if (!producerId) {
              var producerKey = producer["ProducerId"];
              producer["label"] = producerKey;
              producer["imageUrl"] = "/img/activemq/sender.gif";
              producerId = getOrCreate($scope.producers, producerKey, producer);
            }

            $scope.links.push({ source: producerId, target: id });
            // TODO add connections...?
          }
        });
      }
    }
    d3ForceGraph($scope, $scope.nodes, $scope.links);
    $scope.$apply();
  };

  $scope.$watch('workspace.selection', function () {
    if (workspace.moveIfViewInvalid()) return;

    var isQueue = true;
    var jolokia = $scope.workspace.jolokia;
    if (jolokia) {
      var selection = $scope.workspace.selection;
      $scope.selectionDetinationName = null;
      if (selection) {
        if (selection.entries) {
          $scope.selectionDetinationName = selection.entries["Destination"];
          isQueue = selection.entries["Type"] !== "Topic";
        } else if (selection.folderNames) {
          isQueue = selection.folderNames.last() !== "Topic";
        }
      }
      $scope.isQueue = isQueue;
      // TODO detect if we're looking at topics
      var typeName;
      if (isQueue) {
        typeName = "Queue";
      } else {
        typeName = "Topic";
      }
      jolokia.request([
        {type: 'read',
          mbean: "org.apache.activemq:Type=Subscription,destinationType=" + typeName + ",*" },
        {type: 'read',
          mbean: "org.apache.activemq:Type=Producer,*"}
      ], onSuccess([populateSubscribers, populateProducers]));
    }
  });
}