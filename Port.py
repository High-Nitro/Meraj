import socket

def scan_ports(ip, start_port, end_port):
    open_ports = []
    for port in range(start_port, end_port + 1):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.1)
        result = sock.connect_ex((ip, port))
        if result == 0:
            open_ports.append(port)
            print(f"Port {port} is open")
        else:
            print(f"Port {port} is closed")
        sock.close()
    return open_ports

if __name__ == "__main__":
    start_port = int(input("Enter the start port: "))
    end_port = int(input("Enter the end port: "))
    ip = input("Enter the IP address: ")
    open_ports = scan_ports(ip, start_port, end_port)
    if open_ports:
        print(f"Open ports on {ip}: {open_ports}")
    else:
        print(f"No open ports found on {ip} between {start_port} and {end_port}.")
