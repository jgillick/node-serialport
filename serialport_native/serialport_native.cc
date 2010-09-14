// Copyright 2010 Chris Williams <chris@iterativedesigns.com>
#include "serialport_native.h"

#include <sys/types.h>
#include <sys/stat.h>
#include <dirent.h>
#include <fcntl.h>
#include <stdlib.h>
#include <unistd.h>
#include <assert.h>
#include <string.h>
#include <errno.h>
#include <limits.h>

#include <termios.h>
#include <stdio.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/signal.h>
#include <sys/types.h>

#include <node.h>
#include <node_events.h>
#include <node_buffer.h>
#include <v8.h>

using namespace v8;
using namespace node;



// static Persistent<String> encoding_symbol;
// static Persistent<String> errno_symbol;

// #define THROW_BAD_ARGS ThrowException(Exception::TypeError(String::New("Bad argument")))
// 
// static inline Local<Value> errno_exception(int errorno) {
//   Local<Value> e = Exception::Error(String::NewSymbol(strerror(errorno)));
//   Local<Object> obj = e->ToObject();
//   obj->Set(errno_symbol, Integer::New(errorno));
//   return e;
// }





static Persistent<String> data_symbol;
static Persistent<String> close_symbol;



class SerialPort : public EventEmitter {
public:
  static void
  Initialize (v8::Handle<v8::Object> target)
  {
    HandleScope scope;
    Local<FunctionTemplate> t = FunctionTemplate::New(New);

    t->Inherit(EventEmitter::constructor_template);
    t->InstanceTemplate()->SetInternalFieldCount(1);
      
    data_symbol = NODE_PSYMBOL("data");
	  close_symbol = NODE_PSYMBOL("close");
      
    NODE_SET_PROTOTYPE_METHOD(t, "open", Open);
    NODE_SET_PROTOTYPE_METHOD(t, "close", Close);
    NODE_SET_PROTOTYPE_METHOD(t, "write", Write);
    target->Set(String::NewSymbol("SerialPort"), t->GetFunction());
      
  }
    
    
  void signal_handler_IO (int status)
  {
		printf("%i", status);
    printf("received SIGIO signal.\n");
  }


  bool Open(const char* path, int baudrate, int databits, int stopbits, int parity) {
		if (fd_) return false;
    struct termios newtio; 

    long BAUD;
    long DATABITS;
    long STOPBITS;
    long PARITYON;
    long PARITY;


    switch (baudrate)
      {
      case 38400:
      default:
        BAUD = B38400;
        break;
      case 19200:
        BAUD  = B19200;
        break;
      case 9600:
        BAUD  = B9600;
        break;
      case 4800:
        BAUD  = B4800;
        break;
      case 2400:
        BAUD  = B2400;
        break;
      case 1800:
        BAUD  = B1800;
        break;
      case 1200:
        BAUD  = B1200;
        break;
      case 600:
        BAUD  = B600;
        break;
      case 300:
        BAUD  = B300;
        break;
      case 200:
        BAUD  = B200;
        break;
      case 150:
        BAUD  = B150;
        break;
      case 134:
        BAUD  = B134;
        break;
      case 110:
        BAUD  = B110;
        break;
      case 75:
        BAUD  = B75;
        break;
      case 50:
        BAUD  = B50;
        break;
      }

    switch (databits)
      {
      case 8:
      default:
        DATABITS = CS8;
        break;
      case 7:
        DATABITS = CS7;
        break;
      case 6:
        DATABITS = CS6;
        break;
      case 5:
        DATABITS = CS5;
        break;
      }
    switch (stopbits)
      {
      case 1:
      default:
        STOPBITS = 0;
        break;
      case 2:
        STOPBITS = CSTOPB;
        break;
      } 


    switch (parity)
      {
      case 0:
      default:                       //none
        PARITYON = 0;
        PARITY = 0;
        break;
      case 1:                        //odd
        PARITYON = PARENB;
        PARITY = PARODD;
        break;
      case 2:                        //even
        PARITYON = PARENB;
        PARITY = 0;
        break;
      }

    int flags = (O_RDWR | O_NOCTTY | O_NONBLOCK);

    fd_ = open(path, flags);
    if (fd_ < 0) return false;

    struct sigaction saio; 

		// TODO: Hook event emitter to signal handler
    // saio.sa_handler = signal_handler_IO;
		// ENDTODO

    sigemptyset(&saio.sa_mask);   //saio.sa_mask = 0;
    saio.sa_flags = 0;
    //    saio.sa_restorer = NULL;
    sigaction(SIGIO,&saio,NULL);

    //all process to receive SIGIO
    fcntl(fd_, F_SETOWN, getpid());
    fcntl(fd_, F_SETFL, FASYNC);


    newtio.c_cflag = BAUD | CRTSCTS | DATABITS | STOPBITS | PARITYON | PARITY | CLOCAL | CREAD;
    newtio.c_iflag = IGNPAR;
    newtio.c_oflag = 0;
    newtio.c_lflag = 0;       //ICANON;
    newtio.c_cc[VMIN]=1;
    newtio.c_cc[VTIME]=0;
    tcflush(fd_, TCIFLUSH);
    tcsetattr(fd_,TCSANOW,&newtio);

		Ref();
		
    return true;
  }

  int Write(char* buf, size_t length) {
    ssize_t written = write(fd_, buf, length);
    return written;
  }

	void Close (Local<Value> exception = Local<Value>())
  {
    HandleScope scope;
		if (fd_)	{
			close(fd_);
			fd_ = NULL;
		}
    Emit(close_symbol, 0, NULL);
    Unref();
  }



protected:

	static Handle<Value>
	New (const Arguments& args)
	{
	  HandleScope scope;

	  SerialPort *serial_port = new SerialPort();
	  serial_port->Wrap(args.This());

	  return scope.Close(args.This());
	}
	
	static Handle<Value>
	Write (const Arguments& args)
	{
	  HandleScope scope;
      
	  SerialPort *serial_port = ObjectWrap::Unwrap<SerialPort>(args.This());
		if (!Buffer::HasInstance(args[0])) {
	    return ThrowException(Exception::Error(
	                String::New("Second argument needs to be a buffer")));
	  }

	  Local<Object> buffer_obj = args[0]->ToObject();
	  char *buffer_data = Buffer::Data(buffer_obj);
	  size_t buffer_length = Buffer::Length(buffer_obj);
	
		if (buffer_length < 0) {
      return ThrowException(Exception::TypeError(String::New("Bad argument")));
    }
		int written = serial_port->Write(buffer_data, buffer_length);
    if (written < 0) return ThrowException(Exception::Error(String::NewSymbol(strerror(errno))));
		return scope.Close(Integer::New(written));
	}
	
	
	
	static Handle<Value>
	Open (const Arguments& args)
	{
	  HandleScope scope;
      
	  SerialPort *serial_port = ObjectWrap::Unwrap<SerialPort>(args.This());
      
	  long baudrate = 38400;
	  int databits = 8;
	  int stopbits = 1;
	  int parity = 0;

	  if (!args[0]->IsString()) {
	    return scope.Close(ThrowException(Exception::Error(String::New("Must give serial device string as argument"))));
	  }

	  String::Utf8Value path(args[0]->ToString());

	  // Baud Rate Argument
	  if (args.Length() >= 2 && !args[1]->IsInt32()) {
	    return scope.Close(ThrowException(Exception::Error(
	                                                       String::New("If giving baud rate, must be a integer value."))));
	  } else {
	    baudrate = args[1]->Int32Value();
	  }

	  // Data Bits Argument
	  if (args.Length() >= 3 && !args[2]->IsInt32()) {
	    return scope.Close(ThrowException(Exception::Error(
	                                                       String::New("If giving data bits, must be a integer value."))));
	  } else {
	    databits = args[2]->Int32Value();
	  }

	  // Stop Bits Arguments
	  if (args.Length() >= 4 && !args[3]->IsInt32()) {
	    return scope.Close(ThrowException(Exception::Error(
	                                                       String::New("If giving stop bits, must be a integer value."))));
	  } else {
	    stopbits = args[3]->Int32Value();
	  }

	  // parity Arguments
	  if (args.Length() >= 5 && !args[4]->IsInt32()) {
	    return scope.Close(ThrowException(Exception::Error(
	                                                       String::New("If giving parity, must be a integer value."))));
	  } else {
	    parity = args[4]->Int32Value();
	  }
      
      
      
	  bool r = serial_port->Open(*path, baudrate, databits, stopbits, parity);
	  if (!r) {
	    return ThrowException(Exception::Error(
	                                           String::New("Could not open serial port.")));
	  }

	  return scope.Close(Undefined());
	}
	
	
	
  static Handle<Value>
  Close (const Arguments& args)
  {
    SerialPort *serial_port = ObjectWrap::Unwrap<SerialPort>(args.This());
    HandleScope scope;
    serial_port->Close();
    return scope.Close(Undefined());
  }



	// static Handle<Value>
	// Close (const Arguments& args) 
	// {
	//   HandleScope scope;
	// 	if (fd_) {
	//     int ret = close(fd_);
	//     if (ret != 0) return scope.Close(ThrowException(ErrnoException(errno)));
	// 	}
	//     return scope.Close(Undefined());
	// }
	    
	//     
	// static Handle<Value>
	// Write (const Arguments& args)
	// {
	//       
	// }
	// 
	//   
	//   

	SerialPort () : EventEmitter () 
	{
	  fd_ = NULL;
	}

	~SerialPort ()
	{
		if(fd_) { 
			close(fd_); 
			fd_ = NULL;
		}
	}
private:
	int fd_;
    // 
    //     
    //     
    // private:
    //   static inline Local<Value> errno_exception(int errorno) {
    //     Local<Value> e = Exception::Error(String::NewSymbol(strerror(errorno)));
    //     Local<Object> obj = e->ToObject();
    //     obj->Set(errno_symbol, Integer::New(errorno));
    //     return e;
    //   }
    // }
    
};



extern "C" void
init (Handle<Object> target) 
{
  HandleScope scope;
  SerialPort::Initialize(target);
}


