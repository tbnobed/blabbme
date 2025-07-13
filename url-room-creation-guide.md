# URL-Based Room Creation Guide

You can now create chat rooms directly using URLs with query parameters. This is useful for automating room creation or sharing links that automatically create and join rooms.

## URL Formats

### 1. Basic Room Creation
```
https://your-domain.com/?create=true
```
Creates a room with default settings and redirects to the room.

### 2. Custom Room Creation
```
https://your-domain.com/?create=true&name=My%20Meeting&maxParticipants=20&nickname=John
```

### 3. Alternative Path
```
https://your-domain.com/create?name=My%20Meeting&maxParticipants=20&nickname=John
```

## Query Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `create` | Yes | - | Must be set to `true` to trigger room creation |
| `name` | No | "Custom Chat Room" | Name of the room to create |
| `maxParticipants` | No | 10 | Maximum number of participants (2-100) |
| `nickname` | No | - | If provided, automatically joins the room with this nickname |

## Examples

### Create a team meeting room
```
https://your-domain.com/?create=true&name=Team%20Standup&maxParticipants=15
```

### Create and auto-join with nickname
```
https://your-domain.com/?create=true&name=Study%20Group&nickname=Alice
```

### Create a large event room
```
https://your-domain.com/?create=true&name=Webinar%20Chat&maxParticipants=100
```

## URL Encoding

Remember to URL-encode special characters in parameters:
- Space → `%20`
- & → `%26`
- # → `%23`
- + → `%2B`

## Behavior

1. When a URL with `create=true` is accessed, the room is created immediately
2. The URL parameters are cleared from the browser address bar
3. The user is redirected to the newly created room
4. If a `nickname` parameter is provided, the user automatically joins the room
5. Room expires after 30 minutes of inactivity (default)

## Integration Examples

### JavaScript
```javascript
// Create a room programmatically
const createRoomUrl = new URL(window.location.origin);
createRoomUrl.searchParams.set('create', 'true');
createRoomUrl.searchParams.set('name', 'My Custom Room');
createRoomUrl.searchParams.set('maxParticipants', '25');
createRoomUrl.searchParams.set('nickname', 'Host');

window.location.href = createRoomUrl.toString();
```

### HTML Link
```html
<a href="/?create=true&name=Support%20Chat&maxParticipants=5">
  Create Support Room
</a>
```

This feature enables seamless integration with external systems, event management platforms, or automated workflows that need to create chat rooms on demand.