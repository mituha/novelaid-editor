# D2 Rendering Test

## Simple Diagram
```d2
x -> y: Hello D2
```

## More Complex Diagram
```d2
direction: right
Browser -> Server: Request
Server -> Database: Query
Database -> Server: Result
Server -> Browser: Response
```

## Shapes and Containers
```d2
Cloud: {
  shape: cloud
  Service A
  Service B
}
Cloud.Service A -> Cloud.Service B
```
