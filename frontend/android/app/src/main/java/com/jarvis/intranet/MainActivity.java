package com.jarvis.intranet;

import android.util.Log;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private BackendServer server;

    @Override
    public void onStart() {
        super.onStart();
        try {
            server = new BackendServer(8765);
            server.start();
            Log.i("BackendServer", "Embedded server started on port 8765");
        } catch (Exception e) {
            Log.e("BackendServer", "Failed to start server", e);
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        if (server != null) {
            server.stop();
            Log.i("BackendServer", "Embedded server stopped");
        }
    }
}
