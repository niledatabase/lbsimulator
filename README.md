# Load Balancer Simulator

A real-time, interactive visualization tool for demonstrating different load balancing algorithms in action. Built with Three.js and modern JavaScript.



https://github.com/user-attachments/assets/c8b2648c-db57-45e2-a10b-c5ef34700da4



## What is a Load Balancer?

A load balancer is a critical component in distributed systems that acts as a traffic cop, distributing incoming network requests across multiple servers to ensure no single server becomes overwhelmed. This distribution of workload helps to:
- Improve application responsiveness
- Increase availability and reliability
- Handle traffic spikes efficiently
- Prevent server overload
- Enable system scalability

Load balancers make real-time decisions about which server should handle each incoming request based on various factors such as server health, current load, and the specific algorithm being used.

## Understanding the Algorithms

This simulator demonstrates five different load balancing strategies, each with its own advantages and use cases:

### Round Robin
The simplest form of load balancing, Round Robin distributes requests sequentially across the server pool in a circular order. Like dealing cards at a poker table, each server gets its turn in a fixed sequence. This algorithm is:
- Easy to implement and understand
- Fair in distributing requests
- Best suited for scenarios where servers have similar capabilities and requests have similar resource requirements
- Limited in its ability to handle varying server capacities or request complexities

### Random
The Random algorithm assigns each incoming request to a randomly selected server. This approach:
- Provides a good statistical distribution over time
- Requires minimal state tracking
- Can handle server pools with frequent changes
- May lead to uneven distribution in short time frames
- Works well in large-scale deployments where statistical distribution evens out

### Least Requests
This algorithm routes new requests to the server handling the fewest active requests. It:
- Actively prevents server overload
- Maintains better balance in scenarios with varying request processing times
- Requires tracking of current request counts
- Works well when requests have similar resource requirements
- May not be optimal if requests vary significantly in their resource usage

### Least Response Time
A more sophisticated approach that considers the average response time of each server. This algorithm:
- Routes requests to the fastest-responding servers
- Automatically adapts to server performance variations
- Helps identify and avoid slower servers
- Requires historical performance tracking
- Excellent for maintaining optimal user experience
- Particularly useful when server performance varies due to hardware differences or external factors

### Dynamic CPU
A resource-aware algorithm that routes requests based on real-time CPU utilization. This approach:
- Makes decisions based on actual server load rather than request counts
- Prevents CPU-bound servers from becoming overwhelmed
- Adapts to varying request processing requirements
- Requires real-time server metrics
- Ideal for heterogeneous environments where CPU usage is the primary constraint
- Particularly effective when requests have varying CPU requirements

## Features

- **Interactive 3D Visualization**: Watch requests being routed to servers in real-time
- **Multiple Load Balancing Algorithms**:
  - Round Robin
  - Random
  - Least Requests
  - Least Response Time
  - Dynamic CPU-based
- **Real-time Statistics**:
  - CPU and Memory utilization
  - Request counts
  - Average response times
  - Load balance scores
- **Configurable Parameters**:
  - Number of servers (2-20)
  - Request rate (0.1-1000 req/s)
  - Simulation duration
  - Different request types with varying CPU/Memory loads

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/lbsimulator.git
   cd lbsimulator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```
   Note: If port 5173 is in use, Vite will automatically use the next available port.

## Usage

1. **Select Algorithm**: Choose from the available load balancing algorithms in the dropdown menu
2. **Configure Settings**:
   - Adjust the number of servers using the slider
   - Set the request rate (requests per second)
   - Set the simulation duration
3. **Start Simulation**: Click the "Start" button to begin
4. **Monitor Results**:
   - Watch the real-time visualization
   - Monitor server loads and statistics
   - Check rejection counts for overloaded scenarios
5. **Reset**: Use the "Reset" button to start fresh with default settings

## Request Types

The simulator includes different types of requests with varying resource requirements:
- Green: Low CPU (5%), Low Memory (3%)
- Blue: Medium CPU (8%), Low Memory (4%)
- Orange: Low CPU (4%), Medium Memory (8%)
- Red: High CPU (10%), Medium Memory (6%)

## Load Balancing Algorithms

1. **Round Robin**: Distributes requests sequentially across servers
2. **Random**: Randomly selects a server for each request
3. **Least Requests**: Routes to the server handling the fewest requests
4. **Least Response Time**: Selects server with lowest average response time
5. **Dynamic CPU**: Routes requests to the server with lowest CPU utilization

## Development

Built with:
- [Vite](https://vitejs.dev/) - Next Generation Frontend Tooling
- [Three.js](https://threejs.org/) - 3D Graphics Library
- Modern JavaScript (ES6+)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request 
